import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CredentialBroker, MAX_TOKEN_TTL_SECONDS, TokenVerifier } from '../credentialBroker.ts';
import { aggregateTokens, buildInventory, queryCredentialLedger, scanForExposure, tokenDetail } from '../credentialViews.ts';
import { redTeamRunner } from '../redteam.ts';
import { Vault } from '../vault.ts';
import { LEGACY_LABEL } from '../legacyStandingKeyDemo.ts';
import { SEEDED_SCENARIOS } from '../scenarios.ts';
import type { ToolCall } from '../types.ts';
import { eq, JWT_LIKE, makeServiceStack, playScenario, signCustom, skip, suite, yes } from './helpers.ts';
import { hashArgs, TOKEN_AUDIENCE } from '../credentialBroker.ts';

const refund = (amount = 500): ToolCall => ({ tool: 'issue_refund', args: { amount, upiId: 'cust@okaxis' } });
const src = (rel: string) => {
  const f = path.resolve(process.cwd(), rel);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
};
const exec = (st: ReturnType<typeof makeServiceStack>, call: ToolCall, token: string, sessionId = 'sessA') => st.toolServer.executeTool({ toolCall: call, credential: token, sessionId });
const mint = (st: ReturnType<typeof makeServiceStack>, call: ToolCall = refund(), sessionId = 'sessA', agentId = 'agent_x', approvalId?: string) =>
  st.broker.issueToken({ sessionId, agentId, toolCall: call, approvalId });
const events = (st: ReturnType<typeof makeServiceStack>) => st.ledger.all();

export const credentialCases = suite(13, 'Regression 13: No standing credentials (ledger, inventory, vault, TTL, rotation)', [
  // ---- credential ledger
  ['ledger records issued -> redeemed, issued -> revoked, issued -> expired, and rejected (with reason)', () => {
    const st = makeServiceStack();
    const a = mint(st);
    exec(st, refund(), a.token); // redeemed
    const b = mint(st, refund(501));
    st.broker.revokeToken(b.claims.jti, undefined, 'operator');
    exec(st, refund(), a.token); // replay -> rejected
    const c = mint(st, refund(502));
    st.clock.t += 61_000;
    st.broker.sweepExpired(st.clock.t);
    const { tokens, rejections } = aggregateTokens(events(st), st.clock.t);
    const status = (jti: string) => tokens.find((t) => t.jti === jti)?.status;
    return eq(
      { a: 'redeemed', b: 'revoked', c: 'expired', rej: 'REPLAY', reasonText: true, attempts: 1 },
      { a: status(a.claims.jti), b: status(b.claims.jti), c: status(c.claims.jti), rej: rejections[0].code, reasonText: rejections[0].reason.length > 10, attempts: tokens.find((t) => t.jti === a.claims.jti)?.rejectedAttempts }
    );
  }],
  ['ledger never stores a token string (only jti and claims metadata)', () => {
    const st = makeServiceStack();
    const { token } = mint(st);
    exec(st, refund(), token);
    exec(st, refund(), token);
    const text = JSON.stringify(events(st)) + JSON.stringify(st.audit.getEntries());
    return eq({ token: false, jwt: false }, { token: text.includes(token), jwt: JWT_LIKE.test(text) });
  }],
  ['ledger is searchable and filterable (status, agent, tool, session, free text) with pagination', () => {
    const st = makeServiceStack();
    const a = mint(st, refund(), 'sessA', 'agent_one');
    mint(st, { tool: 'lookup_order', args: { orderId: 'ORD-8819' } }, 'sessB', 'agent_two');
    exec(st, refund(), a.token);
    const q = (x: object) => queryCredentialLedger(events(st), x, st.clock.t);
    return eq(
      { all: 2, redeemed: 1, agent: 1, tool: 1, session: 1, jtiSearch: 1, none: 0, page: 1, total: 2 },
      { all: q({}).totalTokens, redeemed: q({ status: 'redeemed' }).totalTokens, agent: q({ agentId: 'agent_two' }).totalTokens, tool: q({ tool: 'lookup_order' }).totalTokens, session: q({ sessionId: 'sessA' }).totalTokens, jtiSearch: q({ search: a.claims.jti }).totalTokens, none: q({ search: 'zzzzzz' }).totalTokens, page: q({ pageSize: 1 }).tokens.length, total: q({ pageSize: 1 }).totalTokens }
    );
  }],
  ['ledger detail drawer data: full lifecycle events for one jti', () => {
    const st = makeServiceStack();
    const a = mint(st);
    exec(st, refund(), a.token);
    exec(st, refund(), a.token);
    const d = tokenDetail(events(st), a.claims.jti, st.clock.t)!;
    return eq({ types: ['TOKEN_ISSUED', 'TOKEN_REDEEMED', 'TOKEN_REJECTED'], approval: undefined }, { types: d.events.map((e) => e.type), approval: d.token.approvalId });
  }],
  ['each rejection reason is logged: replay, cross-session, argument tampering, expired, revoked, bad signature', () => {
    const st = makeServiceStack();
    const a = mint(st);
    exec(st, refund(), a.token);
    exec(st, refund(), a.token); // REPLAY
    const b = mint(st);
    exec(st, refund(), b.token, 'sessB'); // WRONG_SESSION
    const c = mint(st);
    exec(st, refund(50000), c.token); // ARGS_MISMATCH
    const d = mint(st);
    st.broker.revokeToken(d.claims.jti);
    exec(st, refund(), d.token); // REVOKED
    const e = mint(st);
    st.clock.t += 61_000;
    exec(st, refund(), e.token); // EXPIRED
    exec(st, refund(), 'garbage.token.value'); // BAD_HEADER
    const codes = queryCredentialLedger(events(st), { status: 'rejected' }, st.clock.t).rejections.map((r) => r.code).sort();
    return eq(['ARGS_MISMATCH', 'BAD_HEADER', 'EXPIRED', 'REPLAY', 'REVOKED', 'WRONG_SESSION'], codes);
  }],
  ['red-team suite: stolen-token replay, cross-session use, argument tampering, expired and revoked tokens are all rejected AND logged', () => {
    const r = redTeamRunner.runSuite('enforce');
    const want: Record<string, string> = { atk_34: 'REPLAY', atk_35: 'WRONG_SESSION', atk_36: 'ARGS_MISMATCH', atk_54: 'EXPIRED', atk_55: 'REVOKED', atk_56: 'ARGS_MISMATCH' };
    const got = Object.fromEntries(Object.keys(want).map((id) => {
      const x = r.results.find((y) => y.attackId === id)!;
      return [id, x.blockedBy === 'TOKEN_VERIFIER' && !x.harmExecuted && x.rejectionLogged === true ? x.rejectionCode : `FAIL(${x.blockedBy}/${x.rejectionLogged}/${x.harmExecuted})`];
    }));
    return eq(want, got);
  }],
  // ---- TTL
  ['TTL is configurable up to 120 s (applies to new tokens); 0, 121, fractions and strings are rejected; default stays 60', () => {
    const st = makeServiceStack();
    const def = mint(st).claims;
    st.broker.setTtl(120);
    const long = mint(st, refund(7)).claims;
    const bad = [0, 121, 1.5, -5, Number.NaN, '90' as unknown as number].map((v) => {
      try { st.broker.setTtl(v); return 'accepted'; } catch { return 'rejected'; }
    });
    return eq({ def: 60, long: 120, max: 120, bad: Array(6).fill('rejected') }, { def: def.exp - def.iat, long: long.exp - long.iat, max: MAX_TOKEN_TTL_SECONDS, bad });
  }],
  ['a 120 s token verifies; a token longer than 120 s is rejected even if correctly signed; expiry follows the configured TTL', () => {
    const st = makeServiceStack();
    st.broker.setTtl(90);
    const { token } = mint(st);
    st.clock.t += 80_000;
    const within = exec(st, refund(), token).success;
    const t2 = mint(st, refund(9));
    st.clock.t += 91_000;
    const after = exec(st, refund(9), t2.token).success;
    const now = Math.floor(st.clock.t / 1000);
    const forged = signCustom(st.seed, { alg: 'EdDSA', typ: 'JWT', kid: st.broker.kid }, { jti: 'jti_forged_long', sub: 'a', sessionId: 'sessA', tool: 'issue_refund', argsHash: hashArgs(refund().args), iat: now, nbf: now, exp: now + 121, aud: TOKEN_AUDIENCE });
    return eq({ within: true, after: false, forgedLong: false }, { within, after, forgedLong: exec(st, refund(), forged).success });
  }],
  ['TOKEN_TTL_SECONDS env is honoured when valid and ignored when out of range', () => {
    const saved = process.env.TOKEN_TTL_SECONDS;
    try {
      process.env.TOKEN_TTL_SECONDS = '100';
      const a = new CredentialBroker({ quiet: true }).getTtlSeconds();
      process.env.TOKEN_TTL_SECONDS = '500';
      const b = new CredentialBroker({ quiet: true }).getTtlSeconds();
      return eq([100, 60], [a, b]);
    } finally {
      if (saved === undefined) delete process.env.TOKEN_TTL_SECONDS;
      else process.env.TOKEN_TTL_SECONDS = saved;
    }
  }],
  // ---- approval-bound tokens, kill switch, rotation
  ['approval-bound tokens carry approvalId end to end (claims, ledger, graph)', async () => {
    const st = makeServiceStack();
    const s = st.service.createSession({ agentId: 'agent_a', firewallMode: 'enforce' });
    const o = await st.service.execute({ sessionId: s.id, toolCall: refund(5000) });
    st.service.resolveApproval(o.approvalId!, 'APPROVE');
    const issued = st.ledger.bySession(s.id).filter((e) => e.type === 'TOKEN_ISSUED');
    const redeemed = st.ledger.bySession(s.id).filter((e) => e.type === 'TOKEN_REDEEMED');
    return eq({ n: 1, issuedBound: o.approvalId, redeemedBound: o.approvalId }, { n: issued.length, issuedBound: issued[0].data.approvalId, redeemedBound: redeemed[0].data.approvalId });
  }],
  ['a denied or expired approval mints nothing', async () => {
    const st = makeServiceStack();
    const s = st.service.createSession({ agentId: 'agent_a', firewallMode: 'enforce' });
    const o1 = await st.service.execute({ sessionId: s.id, toolCall: refund(5000) });
    st.service.resolveApproval(o1.approvalId!, 'DENY');
    const o2 = await st.service.execute({ sessionId: s.id, toolCall: refund(6000) });
    st.service.expireApprovals(Date.now() + 120_000);
    const issued = st.ledger.bySession(s.id).filter((e) => e.type === 'TOKEN_ISSUED').length;
    return eq({ issued: 0, refunds: 0, resolveAfterExpiry: false }, { issued, refunds: st.toolServer.getRefunds().length, resolveAfterExpiry: st.service.resolveApproval(o2.approvalId!, 'APPROVE').success });
  }],
  ['kill switch revokes ALL outstanding tokens of the agent, logs each revocation, and blocks new calls', async () => {
    let quarantined = false;
    const st = makeServiceStack({ isQuarantined: (id) => quarantined && id === 'agent_k' });
    const s = st.service.createSession({ agentId: 'agent_k', firewallMode: 'enforce' });
    const t1 = mint(st, refund(1), s.id, 'agent_k');
    const t2 = mint(st, refund(2), s.id, 'agent_k');
    const other = mint(st, refund(3), s.id, 'agent_other');
    const n = st.broker.revokeAgent('agent_k', 'kill switch: test');
    quarantined = true;
    const after = await st.service.execute({ sessionId: s.id, toolCall: { tool: 'lookup_order', args: { orderId: 'ORD-8819' } } });
    const revoked = st.ledger.query({ type: 'TOKEN_REVOKED' }).items;
    return eq(
      { n: 2, t1: false, t2: false, other: true, logged: 2, reason: true, blocked: 'KILL_SWITCH_QUARANTINE' },
      { n, t1: exec(st, refund(1), t1.token, s.id).success, t2: exec(st, refund(2), t2.token, s.id).success, other: exec(st, refund(3), other.token, s.id).success, logged: revoked.length, reason: revoked.every((e) => /kill switch/.test(String(e.data.reason))), blocked: after.decision.ruleId }
    );
  }],
  ['key rotation: logged, old tokens stay valid for at most one TTL, new tokens use the new kid', () => {
    const st = makeServiceStack();
    const old = mint(st);
    const r = st.broker.rotateKey();
    st.clock.t += 10_000;
    const oldOk = exec(st, refund(), old.token).success;
    const fresh = mint(st, refund(11));
    const freshOk = exec(st, refund(11), fresh.token).success;
    const ev = st.ledger.query({ type: 'KEY_ROTATED' }).items[0];
    const keysLater = st.broker.getVerificationKeys(st.clock.t + 120_000).map((k) => k.kid);
    return eq({ oldOk: true, freshOk: true, logged: true, oldGone: true, kid: r.newKid }, { oldOk, freshOk, logged: ev?.data.kid === r.newKid && ev?.data.oldKid === r.oldKid, oldGone: !keysLater.includes(r.oldKid), kid: st.broker.kid });
  }],
  ['admin routes exist for TTL and key rotation (admin-gated, validated) and the UI has a rotate button', () => {
    const app = src('server/app.ts');
    const ui = src('src/components/pages/CredentialsPage.tsx');
    if (!app || !ui) return skip('source not available');
    return yes(/'\/api\/credentials\/rotate', admin, body\(S\.EmptyBody\)/.test(app) && /'\/api\/credentials\/ttl', admin, body\(S\.TtlBody\)/.test(app) && /Rotate/.test(ui) && /TTL/.test(ui));
  }],
  // ---- inventory
  ['inventory: every agent shows 0 standing tool credentials vs the labelled legacy simulation (1 unscoped key, N tools)', async () => {
    const st = makeServiceStack();
    await playScenario(st, SEEDED_SCENARIOS.find((s) => s.id === 's1_hr_resume_exfil')!);
    const exposure = scanForExposure(st.vault, { incidents: [], ledgerEvents: events(st), auditEntries: st.audit.getEntries(), outbox: st.toolServer.getOutbox(), refunds: [] });
    const inv = buildInventory({
      events: events(st),
      agents: [{ agentId: 'agent_s1_hr_resume_exfil', appName: 'HR Assistant', allowedTools: ['read_candidate_files', 'update_candidate_status', 'send_email'] }, { agentId: 'agent_idle', allowedTools: ['lookup_order'] }],
      isQuarantined: () => false,
      exposure,
      vaultStatus: st.vault.status(),
      legacyLabel: LEGACY_LABEL,
      nowMs: st.clock.t,
    });
    const hr = inv.agents.find((a) => a.agentId === 'agent_s1_hr_resume_exfil')!;
    return eq(
      { standing: 0, total: 0, legacyKeys: 1, tools: 3, label: LEGACY_LABEL, issued: 1, redeemed: 1, leaks: 0 },
      { standing: hr.standingToolCredentials, total: inv.totals.standingToolCredentials, legacyKeys: hr.legacySimulation.standingKeysHeld, tools: hr.legacySimulation.toolsUnlocked, label: hr.legacySimulation.label, issued: hr.tokensIssued, redeemed: hr.redeemed, leaks: inv.exposureScan.leaks.length }
    );
  }],
  ['inventory is not a constant: a leaked vault secret or token string in any artifact makes the standing count non-zero', () => {
    const v = new Vault();
    const secret = (v as unknown as { secrets: Map<string, string> }).secrets.get('payments_api_key')!;
    const leaked = scanForExposure(v, { incidents: [{ note: `oops ${secret}` }], ledgerEvents: [], auditEntries: [], outbox: [], refunds: [] });
    const clean = scanForExposure(v, { incidents: [], ledgerEvents: [], auditEntries: [], outbox: [], refunds: [] });
    const jwt = `eyJ${'a'.repeat(20)}.${'b'.repeat(20)}.${'c'.repeat(30)}`;
    const tok = scanForExposure(v, { incidents: [], ledgerEvents: [{ x: jwt }], auditEntries: [], outbox: [], refunds: [] });
    return eq({ leaked: 1, clean: 0, tok: 1 }, { leaked: leaked.leaks.length, clean: clean.leaks.length, tok: tok.leaks.length });
  }],
  ['inventory reflects activity per agent: outstanding, revoked, expired, rejected and quarantine state', () => {
    const st = makeServiceStack();
    const a = mint(st, refund(), 'sessA', 'agent_x');
    mint(st, refund(2), 'sessA', 'agent_x');
    exec(st, refund(), a.token);
    exec(st, refund(), a.token); // rejected
    st.broker.revokeAgent('agent_x');
    mint(st, refund(3), 'sessA', 'agent_x');
    const inv = buildInventory({ events: events(st), agents: [{ agentId: 'agent_x', allowedTools: ['issue_refund'] }], isQuarantined: (id) => id === 'agent_x', exposure: scanForExposure(st.vault, { incidents: [], ledgerEvents: [], auditEntries: [], outbox: [], refunds: [] }), vaultStatus: [], legacyLabel: LEGACY_LABEL, nowMs: st.clock.t });
    const r = inv.agents[0];
    return eq({ issued: 3, redeemed: 1, revoked: 1, outstanding: 1, rejected: 1, quarantined: true }, { issued: r.tokensIssued, redeemed: r.redeemed, revoked: r.revoked, outstanding: r.outstandingTokens, rejected: r.rejected, quarantined: r.quarantined });
  }],
  // ---- vault
  ['vault: no method returns a secret; the API is use() / callProvider() / status() / findLeaks() only', () => {
    const names = Object.getOwnPropertyNames(Vault.prototype).sort();
    return eq(['callProvider', 'constructor', 'findLeaks', 'status', 'use'], names);
  }],
  ['vault: env-provided secrets are used, otherwise random per instance; status never contains values', () => {
    const fixed = new Vault({ EMAIL_PROVIDER_API_KEY: 'env-email-secret-value-123', PAYMENTS_API_KEY: 'env-pay-secret-value-456' } as never);
    const a = new Vault({} as never);
    const b = new Vault({} as never);
    const rec = fixed.callProvider('email_provider_api_key', 'p');
    const viaUse = fixed.use('email_provider_api_key', (s) => crypto.createHmac('sha256', s).update('p').digest('hex').slice(0, 16));
    const status = JSON.stringify(fixed.status());
    return eq({ env: 'env', rand: 'random-per-boot', differ: true, receipt: true, noValues: true, uses: 2 }, { env: fixed.status()[0].source, rand: a.status()[0].source, differ: a.callProvider('email_provider_api_key', 'p') !== b.callProvider('email_provider_api_key', 'p'), receipt: rec === viaUse, noValues: !status.includes('env-email-secret') && !status.includes('env-pay-secret'), uses: fixed.status()[0].useCount });
  }],
  ['upstream secrets never appear in ledger events, audit entries, outbox/refund records, evidence or the inventory (end to end)', async () => {
    const st = makeServiceStack();
    const s = st.service.createSession({ agentId: 'agent_a', firewallMode: 'enforce' });
    await st.service.execute({ sessionId: s.id, toolCall: { tool: 'send_email', args: { to: 'ops@example.com', subject: 's', body: 'hello' } } });
    await st.service.execute({ sessionId: s.id, toolCall: refund(500) });
    const text = JSON.stringify([events(st), st.audit.getEntries(), st.toolServer.getOutbox(), st.toolServer.getRefunds(), st.vault.status()]);
    return eq({ leaks: [], receiptsPresent: true }, { leaks: st.vault.findLeaks(text), receiptsPresent: st.toolServer.getOutbox()[0].providerReceipt!.length === 16 });
  }],
  ['source contract: the vault is imported only by the tool server, execution factory, red-team isolates and status/exposure views', () => {
    const dir = path.resolve(process.cwd(), 'server');
    if (!fs.existsSync(dir)) return skip('source not available');
    const importers = fs.readdirSync(dir).filter((f) => f.endsWith('.ts') && /from '\.\/vault\.ts'/.test(fs.readFileSync(path.join(dir, f), 'utf8'))).sort();
    return eq(['app.ts', 'credentialViews.ts', 'executionService.ts', 'protectedTools.ts', 'redteam.ts'], importers);
  }],
  // ---- docs
  ['README documents the broker threat model and says the prototype is a single process', () => {
    const t = src('README.md');
    if (!t) return skip('README not available');
    return yes(/Credential broker threat model/i.test(t) && /single process/i.test(t) && /separate/i.test(t));
  }],
  ['credentials UI has Inventory and Ledger tabs with a detail drawer', () => {
    const t = src('src/components/pages/CredentialsPage.tsx');
    if (!t) return skip('source not available');
    return yes(/Inventory/.test(t) && /Ledger/.test(t) && /Drawer|drawer/.test(t) && /Simulation of the legacy pattern|legacyLabel/.test(t));
  }],
]);
