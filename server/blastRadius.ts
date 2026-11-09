import type { LedgerEvent } from './ledger.ts';
import type { OutboxEmail, RefundRecord } from './protectedTools.ts';

/**
 * Blast radius, "what left", "what was prevented", replay timeline and report drafts, all COMPUTED
 * from the event ledger of one session (plus the outbox / refund records of the tool server when
 * they are still in memory). There are no template nodes: a node exists only if an event created it.
 */

export type NodeStatus = 'allowed' | 'blocked' | 'pending' | 'revoked' | 'expired' | 'rejected' | 'info';
export type EdgeStatus = 'allowed' | 'blocked' | 'pending' | 'revoked';

export interface BlastRadiusNode {
  id: string;
  label: string;
  type: 'untrusted_source' | 'session' | 'tool_call' | 'data_object' | 'outbound_destination' | 'token';
  status: NodeStatus;
  metadata?: Record<string, unknown>;
}

export interface BlastRadiusEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  status: EdgeStatus;
  eventId?: string;
}

export interface LeftPremisesItem {
  callId: string;
  tool: string;
  kind: 'email' | 'refund';
  recipients?: string[];
  upiId?: string;
  amount?: number;
  bytes?: number;
  dataClasses: Record<string, number>;
  recordsReferenced: number;
  source: 'outbox-record' | 'refund-record' | 'ledger-event';
  simulation?: string;
}

export interface PreventedItem {
  callId: string;
  tool: string;
  status: 'blocked' | 'pending';
  ruleId?: string;
  reason?: string;
  recipients?: string[];
  upiId?: string;
  amount?: number;
  wouldHaveSentClasses: Record<string, number>;
}

export interface BlastRadiusSummary {
  leftPremises: {
    items: LeftPremisesItem[];
    recipients: string[];
    payees: string[];
    totalBytes: number;
    totalRefundAmount: number;
    dataClasses: Record<string, number>;
    recordsReferenced: number;
    recordsTouchedInSession: number;
  };
  prevented: { items: PreventedItem[]; count: number; denied: number; pendingApproval: number; dataClasses: Record<string, number> };
}

export interface BlastRadiusGraph {
  incidentId: string;
  sessionId: string;
  nodes: BlastRadiusNode[];
  edges: BlastRadiusEdge[];
  summary: BlastRadiusSummary;
  generatedFrom: { events: number; outboxRecordsMatched: number; refundRecordsMatched: number };
  note?: string;
}

export interface ReplayTimelineStep {
  step: number;
  eventId: string;
  ts: string;
  timeOffsetMs: number;
  phase: string;
  title: string;
  description: string;
  status: 'SUCCESS' | 'BLOCKED' | 'FLAGGED' | 'PENDING';
  nodeRef?: string;
}

export interface IncidentReportDrafts {
  incidentId: string;
  disclaimer: string;
  computedFrom: string;
  certInDraft: {
    title: string;
    reportingTimeline: string;
    organization: string;
    incidentCategory: string;
    affectedSystem: string;
    vulnerabilityIdentified: string;
    chronologyOfEvents: string[];
    technicalRemediation: string;
    mitigationActions: string[];
  };
  dpdpDraft: {
    title: string;
    regulatoryReference: string;
    dataProtectionBoardNotice: string;
    affectedDataPrincipals: string;
    compromisedDataElements: string[];
    actionGateContainmentStatus: string;
    remedialMeasuresImplemented: string[];
  };
}

export const REPORT_DISCLAIMER =
  'Draft for legal and security review. Not legal advice. Whether and when any report is due depends on applicability and current rules, which must be confirmed with counsel; no deadline is asserted here.';

const addCounts = (into: Record<string, number>, from: unknown) => {
  if (!from || typeof from !== 'object') return;
  for (const [k, v] of Object.entries(from as Record<string, unknown>)) if (typeof v === 'number') into[k] = (into[k] ?? 0) + v;
};

interface CallFold {
  callId: string;
  tool: string;
  status: NodeStatus;
  ruleId?: string;
  reason?: string;
  matchedRules?: unknown;
  provenance?: unknown;
  jti?: string;
  approvalId?: string;
  recipients?: string[];
  upiId?: string;
  amount?: number;
  firstEventId: string;
}

export function buildBlastRadius(
  events: LedgerEvent[],
  ctx: { incidentId?: string; sessionId?: string; outbox?: OutboxEmail[]; refunds?: RefundRecord[] } = {}
): BlastRadiusGraph {
  const sessionId = ctx.sessionId ?? events[0]?.sessionId ?? 'unknown';
  const nodes: BlastRadiusNode[] = [];
  const edges: BlastRadiusEdge[] = [];
  const nodeIds = new Set<string>();
  const addNode = (n: BlastRadiusNode) => {
    if (!nodeIds.has(n.id)) {
      nodeIds.add(n.id);
      nodes.push(n);
    }
    return nodes.find((x) => x.id === n.id)!;
  };
  const sessionNodeId = `session:${sessionId}`;
  let outboxMatched = 0;
  let refundMatched = 0;

  const sessionNode = addNode({ id: sessionNodeId, label: `Session ${sessionId.slice(0, 18)}`, type: 'session', status: 'info', metadata: {} });

  // 1. untrusted sources
  for (const e of events.filter((x) => x.type === 'SEGMENT_INGESTED' && x.data.untrusted === true)) {
    const id = `src:${String(e.data.segmentId)}`;
    addNode({ id, label: `${String(e.data.segmentId)} (${String(e.data.trust)})`, type: 'untrusted_source', status: 'info', metadata: { trust: e.data.trust, length: e.data.length, eventId: e.id } });
    edges.push({ id: `e:${id}->session`, source: id, target: sessionNodeId, label: 'ingested', status: 'allowed', eventId: e.id });
  }
  const findings = events.filter((x) => x.type === 'FINDINGS_DETECTED');
  sessionNode.metadata = { findings: findings.reduce((n, e) => n + Number(e.data.count ?? 0), 0), agentId: events.find((e) => e.agentId)?.agentId };

  // 2. fold events per call
  const calls = new Map<string, CallFold>();
  const get = (e: LedgerEvent): CallFold | undefined => {
    if (!e.callId) return undefined;
    let c = calls.get(e.callId);
    if (!c) {
      c = { callId: e.callId, tool: e.tool ?? 'unknown', status: 'pending', firstEventId: e.id };
      calls.set(e.callId, c);
    }
    return c;
  };
  const dataObjects = new Map<string, { callIds: string[]; classes: Record<string, number> }>();
  const destinations = new Map<string, { label: string; kind: 'email' | 'upi'; status: NodeStatus; calls: Array<{ callId: string; status: NodeStatus; eventId: string }> }>();
  const left: LeftPremisesItem[] = [];
  const prevented: PreventedItem[] = [];
  const allReadObjects = new Set<string>();
  const preventedClasses: Record<string, number> = {};
  const leftClasses: Record<string, number> = {};
  let leftBytes = 0;
  let leftRefund = 0;
  let leftRecords = 0;

  const rank: Record<NodeStatus, number> = { allowed: 3, pending: 2, blocked: 1, info: 0, revoked: 0, expired: 0, rejected: 0 };
  const touchDest = (key: string, label: string, kind: 'email' | 'upi', callId: string, status: NodeStatus, eventId: string) => {
    const d = destinations.get(key) ?? { label, kind, status, calls: [] };
    d.calls.push({ callId, status, eventId });
    if (d.calls.length === 1 || rank[status] > rank[d.status]) d.status = status;
    destinations.set(key, d);
  };
  const destsOf = (e: LedgerEvent) => {
    const out: Array<{ key: string; label: string; kind: 'email' | 'upi' }> = [];
    for (const r of (e.data.recipients as string[] | undefined) ?? []) out.push({ key: `dest:email:${r}`, label: r, kind: 'email' });
    if (typeof e.data.upiId === 'string') out.push({ key: `dest:upi:${e.data.upiId}`, label: e.data.upiId, kind: 'upi' });
    return out;
  };

  for (const e of events) {
    const c = get(e);
    switch (e.type) {
      case 'TOOL_PROPOSED':
        if (c) {
          c.tool = e.tool ?? c.tool;
          c.recipients = e.data.recipients as string[] | undefined;
          c.upiId = e.data.upiId as string | undefined;
          c.amount = e.data.amount as number | undefined;
        }
        break;
      case 'ARG_PROVENANCE':
        if (c) c.provenance = e.data;
        break;
      case 'POLICY_DECISION':
        if (c) {
          c.ruleId = e.ruleId;
          c.reason = String(e.data.reason ?? '');
          c.matchedRules = e.data.matchedRules;
          if (e.action === 'deny') c.status = 'blocked';
          else if (e.action === 'approve') c.status = 'pending';
          else c.status = 'pending'; // allow: becomes allowed when executed
        }
        break;
      case 'APPROVAL_QUEUED':
        if (c) {
          c.status = 'pending';
          c.approvalId = String(e.data.approvalId);
          for (const d of destsOf(e)) touchDest(d.key, d.label, d.kind, c.callId, 'pending', e.id);
        }
        break;
      case 'APPROVAL_RESOLVED':
        if (c && e.data.status !== 'APPROVED') c.status = 'blocked';
        break;
      case 'TOOL_EXECUTED':
        if (c) {
          c.status = 'allowed';
          c.jti = (e.data.jti as string | undefined) ?? c.jti;
          const classes = (e.data.dataClasses as Record<string, number> | undefined) ?? {};
          for (const id of (e.data.dataObjects as string[] | undefined) ?? []) {
            allReadObjects.add(id);
            const d = dataObjects.get(id) ?? { callIds: [], classes: {} };
            if (!d.callIds.includes(c.callId)) d.callIds.push(c.callId);
            d.classes = classes;
            dataObjects.set(id, d);
          }
          const dests = destsOf(e);
          for (const d of dests) touchDest(d.key, d.label, d.kind, c.callId, 'allowed', e.id);
          if (dests.length > 0) {
            // cross-check with the real outbox / refund record when it is still in memory
            const recordId = e.data.recordId as string | undefined;
            const ob = ctx.outbox?.find((o) => o.id === recordId);
            const rf = ctx.refunds?.find((r) => r.id === recordId);
            if (ob) outboxMatched++;
            if (rf) refundMatched++;
            const isEmail = e.tool === 'send_email';
            const item: LeftPremisesItem = {
              callId: c.callId,
              tool: e.tool ?? 'unknown',
              kind: isEmail ? 'email' : 'refund',
              recipients: isEmail ? (ob ? [ob.to, ...(ob.cc ?? []), ...(ob.bcc ?? [])].flatMap((x) => x.split(', ')) : (e.data.recipients as string[])) : undefined,
              upiId: !isEmail ? (rf?.upiId ?? (e.data.upiId as string)) : undefined,
              amount: !isEmail ? (rf?.amount ?? (e.data.amount as number)) : undefined,
              bytes: isEmail ? (ob?.bytes ?? (e.data.bytes as number | undefined)) : undefined,
              dataClasses: classes,
              recordsReferenced: Number(e.data.dataObjectsReferencedInBody ?? 0),
              source: ob ? 'outbox-record' : rf ? 'refund-record' : 'ledger-event',
              simulation: e.data.simulation as string | undefined,
            };
            left.push(item);
            addCounts(leftClasses, classes);
            leftBytes += item.bytes ?? 0;
            leftRefund += item.amount ?? 0;
            leftRecords += item.recordsReferenced;
          }
        }
        break;
      case 'TOOL_BLOCKED':
        if (c) {
          if (c.status !== 'allowed') c.status = 'blocked';
          c.jti = (e.data.jti as string | undefined) ?? c.jti;
          c.reason = c.reason || String(e.data.reason ?? '');
          for (const d of destsOf(e)) touchDest(d.key, d.label, d.kind, c.callId, 'blocked', e.id);
          const wouldHave = (e.data.wouldHaveSentClasses as Record<string, number> | undefined) ?? {};
          prevented.push({
            callId: c.callId,
            tool: c.tool,
            status: 'blocked',
            ruleId: c.ruleId,
            reason: c.reason,
            recipients: c.recipients,
            upiId: c.upiId,
            amount: c.amount,
            wouldHaveSentClasses: wouldHave,
          });
          addCounts(preventedClasses, wouldHave);
        }
        break;
      default:
        break;
    }
  }
  // calls still waiting for a human decision count as prevented-for-now (pending)
  for (const c of calls.values()) {
    if (c.status === 'pending' && c.approvalId && !prevented.some((p) => p.callId === c.callId)) {
      prevented.push({ callId: c.callId, tool: c.tool, status: 'pending', ruleId: c.ruleId, reason: c.reason, recipients: c.recipients, upiId: c.upiId, amount: c.amount, wouldHaveSentClasses: {} });
    }
  }

  // 3. tokens (from credential events)
  const tokens = new Map<string, { status: NodeStatus; reason?: string; tool?: string; events: string[] }>();
  for (const e of events) {
    const jti = e.data.jti as string | undefined;
    if (!e.type.startsWith('TOKEN_')) continue;
    const key = jti ?? `rejected:${e.id}`;
    const t = tokens.get(key) ?? { status: 'info' as NodeStatus, tool: e.tool, events: [] as string[] };
    t.events.push(e.id);
    if (e.type === 'TOKEN_ISSUED') t.status = 'pending';
    if (e.type === 'TOKEN_REDEEMED') t.status = 'allowed';
    if (e.type === 'TOKEN_REVOKED') {
      t.status = 'revoked';
      t.reason = String(e.data.reason ?? '');
    }
    if (e.type === 'TOKEN_EXPIRED') t.status = 'expired';
    if (e.type === 'TOKEN_REJECTED') {
      if (t.status === 'info' || !jti) t.status = 'rejected';
      t.reason = String(e.data.code ?? '') + ': ' + String(e.data.reason ?? '');
    }
    tokens.set(key, t);
  }

  // 4. materialise call / data / destination / token nodes and edges
  for (const c of calls.values()) {
    const id = `call:${c.callId}`;
    addNode({
      id,
      label: `${c.tool}()`,
      type: 'tool_call',
      status: c.status,
      metadata: { ruleId: c.ruleId, reason: c.reason, matchedRules: c.matchedRules, provenance: c.provenance, approvalId: c.approvalId },
    });
    edges.push({ id: `e:session->${id}`, source: sessionNodeId, target: id, label: c.status === 'blocked' ? 'proposed (blocked)' : c.status === 'pending' ? 'proposed (pending)' : 'proposed', status: c.status === 'allowed' ? 'allowed' : c.status === 'pending' ? 'pending' : 'blocked', eventId: c.firstEventId });
  }
  for (const [objId, d] of dataObjects) {
    const id = `data:${objId}`;
    addNode({ id, label: objId, type: 'data_object', status: 'allowed', metadata: { dataClasses: d.classes, touchedBy: d.callIds } });
    for (const callId of d.callIds) edges.push({ id: `e:call:${callId}->${id}`, source: `call:${callId}`, target: id, label: 'read', status: 'allowed' });
  }
  for (const [key, d] of destinations) {
    addNode({ id: key, label: d.label, type: 'outbound_destination', status: d.status, metadata: { kind: d.kind, sessionHadPrivateData: allReadObjects.size > 0, note: d.status === 'allowed' ? 'Data was transmitted to this destination' : d.status === 'pending' ? 'Held for human approval' : 'Blocked before sending' } });
    for (const x of d.calls) {
      edges.push({ id: `e:call:${x.callId}->${key}`, source: `call:${x.callId}`, target: key, label: x.status === 'allowed' ? 'SENT' : x.status === 'pending' ? 'held for approval' : 'blocked', status: x.status === 'allowed' ? 'allowed' : x.status === 'pending' ? 'pending' : 'blocked', eventId: x.eventId });
    }
  }
  for (const [key, t] of tokens) {
    const id = `token:${key.slice(0, 22)}`;
    addNode({ id, label: key.startsWith('rejected:') ? 'rejected token attempt' : `token ${key.slice(0, 14)}…`, type: 'token', status: t.status, metadata: { jti: key.startsWith('rejected:') ? undefined : key, reason: t.reason, events: t.events } });
    const call = Array.from(calls.values()).find((c) => c.jti === key);
    if (call) {
      edges.push({ id: `e:call:${call.callId}->${id}`, source: `call:${call.callId}`, target: id, label: t.status === 'revoked' ? 'token revoked' : t.status === 'expired' ? 'token expired' : t.status === 'allowed' ? 'authorised by (redeemed)' : t.status === 'rejected' ? 'token rejected' : 'authorised by', status: t.status === 'revoked' ? 'revoked' : t.status === 'rejected' ? 'blocked' : 'allowed' });
    }
  }

  const summary: BlastRadiusSummary = {
    leftPremises: {
      items: left,
      recipients: Array.from(new Set(left.flatMap((l) => l.recipients ?? []))),
      payees: Array.from(new Set(left.map((l) => l.upiId).filter((x): x is string => Boolean(x)))),
      totalBytes: leftBytes,
      totalRefundAmount: leftRefund,
      dataClasses: leftClasses,
      recordsReferenced: leftRecords,
      recordsTouchedInSession: allReadObjects.size,
    },
    prevented: {
      items: prevented,
      count: prevented.length,
      denied: prevented.filter((p) => p.status === 'blocked').length,
      pendingApproval: prevented.filter((p) => p.status === 'pending').length,
      dataClasses: preventedClasses,
    },
  };
  return {
    incidentId: ctx.incidentId ?? sessionId,
    sessionId,
    nodes,
    edges,
    summary,
    generatedFrom: { events: events.length, outboxRecordsMatched: outboxMatched, refundRecordsMatched: refundMatched },
    note: events.length === 0 ? 'No ledger events exist for this session (for example a seeded sample incident). Run a scenario to see a real blast radius.' : undefined,
  };
}

const PHASE: Record<string, string> = {
  SESSION_START: 'Session',
  SEGMENT_INGESTED: 'Ingestion',
  FINDINGS_DETECTED: 'Detectors',
  LLM_RESPONSE: 'Agent',
  OUTPUT_INSPECTED: 'Output inspection',
  TOOL_PROPOSED: 'Agent',
  ARG_PROVENANCE: 'Provenance',
  POLICY_DECISION: 'Action gate',
  APPROVAL_QUEUED: 'Approval',
  APPROVAL_RESOLVED: 'Approval',
  TOKEN_ISSUED: 'Credentials',
  TOKEN_REDEEMED: 'Credentials',
  TOKEN_REJECTED: 'Credentials',
  TOKEN_EXPIRED: 'Credentials',
  TOKEN_REVOKED: 'Credentials',
  TOOL_EXECUTED: 'Tool server',
  TOOL_BLOCKED: 'Tool server',
  KILL_SWITCH: 'Response',
  SESSION_END: 'Session',
};

function describe(e: LedgerEvent): { title: string; description: string; status: ReplayTimelineStep['status'] } {
  const d = e.data;
  switch (e.type) {
    case 'SESSION_START':
      return { title: 'Session started', description: `Agent ${e.agentId ?? '?'} in ${String(d.firewallMode)} mode`, status: 'SUCCESS' };
    case 'SEGMENT_INGESTED':
      return { title: `Segment ${String(d.segmentId)} ingested`, description: `trust=${String(d.trust)}, ${String(d.length)} chars`, status: d.untrusted ? 'FLAGGED' : 'SUCCESS' };
    case 'FINDINGS_DETECTED':
      return { title: `${String(d.count)} detector finding(s)`, description: `max injection score ${String(d.maxInjectionScore)}; ${JSON.stringify(d.byCategory)}`, status: Number(d.count) > 0 ? 'FLAGGED' : 'SUCCESS' };
    case 'OUTPUT_INSPECTED':
      return { title: d.changed ? 'Output rewritten' : 'Output clean', description: `${String(d.changeCount)} change(s)`, status: d.changed ? 'FLAGGED' : 'SUCCESS' };
    case 'TOOL_PROPOSED':
      return { title: `Agent proposed ${e.tool}()`, description: `call ${e.callId}`, status: 'SUCCESS' };
    case 'ARG_PROVENANCE':
      return { title: 'Argument provenance match', description: `${(d.matches as unknown[] | undefined)?.length ?? 0} match(es); recipient/payee from untrusted: ${String(d.recipientOrPayeeDerivedFromUntrusted)}`, status: 'FLAGGED' };
    case 'POLICY_DECISION':
      return { title: `Gate: ${String(e.action).toUpperCase()}`, description: `${e.ruleId}: ${String(d.reason ?? '').slice(0, 200)}`, status: e.action === 'allow' ? 'SUCCESS' : e.action === 'approve' ? 'PENDING' : 'BLOCKED' };
    case 'APPROVAL_QUEUED':
      return { title: 'Held for human approval', description: String(d.approvalId), status: 'PENDING' };
    case 'APPROVAL_RESOLVED':
      return { title: `Approval ${String(d.status)}`, description: String(d.decisionNotes ?? ''), status: d.status === 'APPROVED' ? 'SUCCESS' : 'BLOCKED' };
    case 'TOKEN_ISSUED':
      return { title: 'One-time token issued', description: `jti ${String(d.jti).slice(0, 14)}…, ttl ${String(d.ttlSeconds)}s, bound to args ${String(d.argsHash).slice(0, 10)}…`, status: 'SUCCESS' };
    case 'TOKEN_REDEEMED':
      return { title: 'Token redeemed', description: `jti ${String(d.jti).slice(0, 14)}…`, status: 'SUCCESS' };
    case 'TOKEN_REJECTED':
      return { title: 'Token REJECTED', description: `${String(d.code)}: ${String(d.reason).slice(0, 160)}`, status: 'BLOCKED' };
    case 'TOKEN_EXPIRED':
      return { title: 'Token expired unused', description: `jti ${String(d.jti).slice(0, 14)}…`, status: 'SUCCESS' };
    case 'TOKEN_REVOKED':
      return { title: 'Token revoked', description: `${String(d.reason)} (jti ${String(d.jti).slice(0, 14)}…)`, status: 'BLOCKED' };
    case 'TOOL_EXECUTED':
      return {
        title: `${e.tool}() executed`,
        description: `${d.recipients ? `to ${(d.recipients as string[]).join(', ')}` : d.upiId ? `to ${String(d.upiId)} INR ${String(d.amount)}` : `${String(d.recordCount ?? 0)} record(s)`}${d.simulation ? ` [${String(d.simulation)}]` : ''}`,
        status: d.recipients || d.upiId ? 'FLAGGED' : 'SUCCESS',
      };
    case 'TOOL_BLOCKED':
      return { title: `${e.tool}() blocked`, description: String(d.reason ?? '').slice(0, 200), status: 'BLOCKED' };
    case 'KILL_SWITCH':
      return { title: `Kill switch ${String(d.state)}`, description: String(d.reason ?? ''), status: 'BLOCKED' };
    default:
      return { title: e.type, description: '', status: 'SUCCESS' };
  }
}

/** Replay steps with REAL timestamps (offsets are differences between event timestamps). */
export function buildTimeline(events: LedgerEvent[]): ReplayTimelineStep[] {
  const t0 = events.length ? Date.parse(events[0].ts) : 0;
  return events
    .map((e, i) => {
      const d = describe(e);
      return {
        step: i + 1,
        eventId: e.id,
        ts: e.ts,
        timeOffsetMs: Date.parse(e.ts) - t0,
        phase: PHASE[e.type] ?? e.type,
        title: d.title,
        description: d.description,
        status: d.status,
        nodeRef: e.callId ? `call:${e.callId}` : undefined,
      };
    });
}

export function buildReportDrafts(
  incidentId: string,
  events: LedgerEvent[],
  graph: BlastRadiusGraph,
  meta: { scenarioTitle?: string; firewallMode?: string } = {}
): IncidentReportDrafts {
  const timeline = buildTimeline(events);
  const left = graph.summary.leftPremises;
  const prevented = graph.summary.prevented;
  const classes = Object.keys(left.dataClasses);
  const preventedClasses = Object.keys(prevented.dataClasses);
  const untrusted = events.filter((e) => e.type === 'SEGMENT_INGESTED' && e.data.untrusted === true);
  const nothingLeft = left.items.length === 0;
  const chronology = timeline.slice(0, 40).map((s) => `T+${s.timeOffsetMs}ms [${s.phase}] ${s.title}${s.description ? ' - ' + s.description : ''}`);
  return {
    incidentId,
    disclaimer: REPORT_DISCLAIMER,
    computedFrom: `Computed from ${events.length} ledger events of session ${graph.sessionId} (committed to the keyed audit chain); outbox/refund records matched: ${graph.generatedFrom.outboxRecordsMatched}/${graph.generatedFrom.refundRecordsMatched}.`,
    certInDraft: {
      title: 'Cyber security incident report: DRAFT',
      reportingTimeline: 'Not asserted. Confirm applicability and any deadline with legal counsel before relying on this draft.',
      organization: 'Enterprise Autonomous Systems Division (synthetic)',
      incidentCategory: 'AI agent instruction hijack (prompt injection) via untrusted content',
      affectedSystem: `AI agent runtime${meta.scenarioTitle ? ` (${meta.scenarioTitle})` : ''}, mode ${meta.firewallMode ?? 'unknown'}`,
      vulnerabilityIdentified: untrusted.length
        ? `Untrusted content was ingested from ${untrusted.length} segment(s): ${untrusted.map((e) => String(e.data.segmentId)).join(', ')}`
        : 'No untrusted segment was recorded in this session.',
      chronologyOfEvents: chronology,
      technicalRemediation: 'Action gate on every tool call, no standing credentials on the real path, one-time Ed25519 tokens bound to the exact call, keyed audit chain.',
      mitigationActions: [
        `${prevented.denied} call(s) denied and ${prevented.pendingApproval} held for approval by the gate`,
        `${events.filter((e) => e.type === 'TOKEN_REVOKED').length} token(s) revoked, ${events.filter((e) => e.type === 'TOKEN_REJECTED').length} token presentation(s) rejected`,
        'All steps committed to the keyed audit chain; see the evidence bundle for proofs',
      ],
    },
    dpdpDraft: {
      title: 'Personal data breach intimation: DRAFT',
      regulatoryReference: 'Applicable provisions and timelines to be confirmed by counsel.',
      dataProtectionBoardNotice: nothingLeft ? 'Computed data shows no outbound transmission in this session; counsel to decide whether any notice is needed.' : 'Computed data shows outbound transmission; counsel to decide on notice.',
      affectedDataPrincipals: `${left.recordsTouchedInSession} record(s) were read in this session (synthetic data); ${left.recordsReferenced} record id(s) appear in outbound message bodies.`,
      compromisedDataElements: classes.length ? classes.map((c) => `${c} x${left.dataClasses[c]}`) : [],
      actionGateContainmentStatus: nothingLeft
        ? `No data left the premises according to outbox/refund records and ledger. Prevented: ${preventedClasses.length ? preventedClasses.map((c) => `${c} x${prevented.dataClasses[c]}`).join(', ') : 'no classified data in blocked bodies'}.`
        : `Left the premises: ${left.recipients.length} recipient(s) [${left.recipients.join(', ')}], ${left.totalBytes} bytes, ${left.payees.length} payee(s), refunds INR ${left.totalRefundAmount}.`,
      remedialMeasuresImplemented: [
        'Gate decisions, provenance matches and token lifecycle recorded as ledger events',
        'Outbound email bodies are redacted (R5) and markdown images/links to non-allow-listed hosts are rewritten before the gate',
      ],
    },
  };
}
