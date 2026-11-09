import crypto from 'node:crypto';
import type {
  ApprovalItem,
  Finding,
  FirewallMode,
  GateDecision,
  Segment,
  SessionState,
  ToolCall,
  ToolResult,
} from './types.ts';
import { normalizeContent } from './normalization.ts';
import { detectPromptInjection } from './detectors/injection.ts';
import { detectPiiAndSecrets } from './detectors/pii.ts';
import { checkCanaryLeak } from './detectors/canary.ts';
import { detectOutputExfiltration } from './detectors/exfiltration.ts';
import { PolicyEngine } from './policyEngine.ts';
import { CredentialBroker, TokenVerifier, hashArgs } from './credentialBroker.ts';
import { ProtectedToolServer } from './protectedTools.ts';
import { LegacyStandingKeyDemo, LEGACY_LABEL } from './legacyStandingKeyDemo.ts';
import { validateToolArgs } from './toolSchemas.ts';
import { collectDataObjects, createSessionState, recordToolResult } from './sessionState.ts';
import { ArgProvenance, findArgProvenance } from './provenance.ts';
import { EventLedger } from './ledger.ts';
import { analyzeRecipients } from './emailRecipients.ts';
import { sha256Hex } from './canonical.ts';
import { Vault } from './vault.ts';

/**
 * The single execution path for protected tools. Used by the scenario runner AND by
 * POST /v1/tools/execute. Nothing else may call ProtectedToolServer.executeTool.
 *
 * For every call: validate args -> kill-switch check -> argument provenance -> policy (all enabled
 * rules, real SessionState) -> approval if needed -> one-time token minted INTERNALLY -> tool server
 * verifies and executes -> session state + ledger updated. Tokens never leave this module.
 */

export interface SessionRecord {
  id: string;
  agentId: string;
  scenarioId?: string;
  firewallMode: FirewallMode;
  createdAt: number;
  segments: Segment[];
  findings: Finding[];
  maxInjectionScore: number;
  state: SessionState;
  segmentHashes: Set<string>;
  calls: number;
}

export type ExecutionStatus = 'executed' | 'failed' | 'blocked' | 'pending_approval';

export interface ExecutionOutcome {
  status: ExecutionStatus;
  callId: string;
  sessionId: string;
  decision: GateDecision;
  provenance: ArgProvenance;
  toolResult?: ToolResult;
  approvalId?: string;
  /** the (possibly normalised) call that was evaluated */
  toolCall: ToolCall;
  notes: string[];
}

export interface ExecutionDeps {
  ledger: EventLedger;
  broker: CredentialBroker;
  verifier: TokenVerifier;
  toolServer: ProtectedToolServer;
  engine: PolicyEngine;
  legacy: LegacyStandingKeyDemo;
  isQuarantined: (agentId: string) => boolean;
  /** called after every ledger-visible change to the incident store etc. */
  onApprovalResolved?: (item: ApprovalItem, result: ToolResult) => void;
  maxSessions?: number;
}

export type DataClassCounts = Record<string, number>;

/** Counts PII / secret categories found by the real detectors in a piece of text. */
export function classifyData(text: string): DataClassCounts {
  const seg: Segment = { id: 'classify', role: 'tool', content: text, trust: 'TOOL_OUTPUT', labelSource: 'classifier' };
  const counts: DataClassCounts = {};
  for (const f of detectPiiAndSecrets(seg)) {
    const key = f.category.replace(/^PII_/, '');
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function countRecords(data: unknown): number {
  if (!data || typeof data !== 'object') return 0;
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.candidates)) return d.candidates.length;
  if (typeof d.id === 'string' || typeof d.orderId === 'string') return 1;
  return 0;
}

function destinationsOf(call: ToolCall): { recipients?: string[]; upiId?: string; amount?: number } {
  const a = call.args as Record<string, unknown>;
  if (call.tool === 'send_email') {
    const all = ['to', 'cc', 'bcc'].flatMap((k) => (a[k] === undefined ? [] : analyzeRecipients({ to: a[k] }).addresses));
    return { recipients: all };
  }
  if (call.tool === 'issue_refund') return { upiId: String(a.upiId), amount: Number(a.amount) };
  return {};
}

export class ExecutionService {
  public readonly sessions = new Map<string, SessionRecord>();
  public readonly approvals = new Map<string, ApprovalItem>();
  private sweeper?: NodeJS.Timeout;

  constructor(public readonly deps: ExecutionDeps) {
    this.sweeper = setInterval(() => this.expireApprovals(), 5000);
    this.sweeper.unref?.();
  }

  public stop(): void {
    if (this.sweeper) clearInterval(this.sweeper);
  }

  // ------------------------------------------------------------------ sessions

  public createSession(params: {
    agentId: string;
    firewallMode?: FirewallMode;
    scenarioId?: string;
    sessionId?: string;
    segments?: Segment[];
  }): SessionRecord {
    const id = params.sessionId ?? `sess_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const rec: SessionRecord = {
      id,
      agentId: params.agentId,
      scenarioId: params.scenarioId,
      firewallMode: params.firewallMode ?? 'enforce',
      createdAt: Date.now(),
      segments: [],
      findings: [],
      maxInjectionScore: 0,
      state: createSessionState(id, []),
      segmentHashes: new Set(),
      calls: 0,
    };
    this.sessions.set(id, rec);
    const cap = this.deps.maxSessions ?? 1000;
    while (this.sessions.size > cap) this.sessions.delete(this.sessions.keys().next().value as string);
    this.deps.ledger.record({
      sessionId: id,
      type: 'SESSION_START',
      agentId: rec.agentId,
      data: { firewallMode: rec.firewallMode, scenarioId: params.scenarioId },
    });
    if (params.segments?.length) this.ingest(id, params.segments);
    return rec;
  }

  public getSession(id: string): SessionRecord | undefined {
    return this.sessions.get(id);
  }

  /**
   * Normalises and ingests segments (deduplicated by content hash), runs the detectors and records
   * one SEGMENT_INGESTED event per new segment plus one FINDINGS_DETECTED event.
   * Returns the segments that were new.
   */
  public ingest(sessionId: string, segments: Segment[]): Segment[] {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error(`Unknown session ${sessionId}`);
    const added: Segment[] = [];
    const newFindings: Finding[] = [];
    for (const raw of segments) {
      const content = normalizeContent(raw.content).normalized;
      const h = sha256Hex(`${raw.role}\n${raw.trust}\n${content}`);
      if (s.segmentHashes.has(h)) continue;
      s.segmentHashes.add(h);
      const seg: Segment = { ...raw, content, labelSource: raw.labelSource || 'app-marked' };
      s.segments.push(seg);
      added.push(seg);

      const inj = detectPromptInjection(seg);
      if (inj.score > s.maxInjectionScore) s.maxInjectionScore = inj.score;
      newFindings.push(...inj.findings, ...detectPiiAndSecrets(seg));
      const canary = checkCanaryLeak(seg.content, seg.id);
      if (canary) newFindings.push(canary);
      newFindings.push(...detectOutputExfiltration(seg.content, seg.id));

      if (seg.trust === 'TOOL_OUTPUT' || seg.trust === 'RETRIEVED_DOC' || seg.trust === 'UNKNOWN') s.state.untrustedIngested = true;
      this.deps.ledger.record({
        sessionId,
        type: 'SEGMENT_INGESTED',
        agentId: s.agentId,
        data: { segmentId: seg.id, role: seg.role, trust: seg.trust, labelSource: seg.labelSource, length: seg.content.length, contentSha256: sha256Hex(seg.content), untrusted: seg.trust !== 'USER' && seg.trust !== 'SYSTEM' },
      });
    }
    if (added.length) {
      s.findings.push(...newFindings);
      const byCategory: Record<string, number> = {};
      for (const f of newFindings) byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
      this.deps.ledger.record({
        sessionId,
        type: 'FINDINGS_DETECTED',
        agentId: s.agentId,
        data: { count: newFindings.length, byCategory, maxInjectionScore: s.maxInjectionScore, evidenceHashes: newFindings.map((f) => f.evidenceHash).slice(0, 50) },
      });
    }
    return added;
  }

  // ------------------------------------------------------------------ evaluation

  /** Evaluate without executing (used to annotate tool_calls in chat completions). */
  public preview(sessionId: string, toolCall: ToolCall): { decision: GateDecision; provenance: ArgProvenance; argsValid: boolean; error?: string } {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error(`Unknown session ${sessionId}`);
    const mode = s.firewallMode;
    const v = validateToolArgs(toolCall.tool, toolCall.args);
    const emptyProv = findArgProvenance({ tool: toolCall.tool, args: {} }, []);
    if (!v.ok) {
      return {
        argsValid: false,
        error: v.error,
        provenance: emptyProv,
        decision: { action: 'deny', ruleId: 'ARGS_INVALID', reason: v.error, shadowWouldBlock: true, riskLevel: 'HIGH', firewallMode: mode },
      };
    }
    const call = { tool: toolCall.tool, args: v.args };
    const provenance = findArgProvenance(call, s.segments);
    if (this.deps.isQuarantined(s.agentId)) {
      return {
        argsValid: true,
        provenance,
        decision: { action: 'deny', ruleId: 'KILL_SWITCH_QUARANTINE', reason: `Agent "${s.agentId}" is quarantined by the kill switch.`, shadowWouldBlock: true, riskLevel: 'HIGH', firewallMode: mode },
      };
    }
    const decision = this.deps.engine.evaluate({
      toolCall: call,
      segments: s.segments,
      findings: s.findings,
      injectionScore: s.maxInjectionScore,
      firewallMode: mode,
      sessionState: s.state,
      argProvenance: provenance,
    });
    return { argsValid: true, provenance, decision };
  }

  // ------------------------------------------------------------------ execution

  public async execute(req: { sessionId: string; toolCall: ToolCall; callId?: string }): Promise<ExecutionOutcome> {
    const s = this.sessions.get(req.sessionId);
    if (!s) throw new Error(`Unknown session ${req.sessionId}`);
    const { ledger } = this.deps;
    const callId = req.callId ?? `call_${crypto.randomBytes(5).toString('hex')}`;
    s.calls++;
    const notes: string[] = [];

    const rawCall = req.toolCall;
    const pre = this.preview(s.id, rawCall);
    const validated = validateToolArgs(rawCall.tool, rawCall.args);
    const call: ToolCall = validated.ok ? { tool: rawCall.tool, args: validated.args } : rawCall;
    const dest = validated.ok ? destinationsOf(call) : {};

    ledger.record({
      sessionId: s.id,
      type: 'TOOL_PROPOSED',
      agentId: s.agentId,
      callId,
      tool: call.tool,
      data: { argKeys: Object.keys(rawCall.args ?? {}), argsHash: validated.ok ? hashArgs(call.args) : undefined, ...dest },
    });
    if (pre.provenance.matches.length > 0) {
      ledger.record({
        sessionId: s.id,
        type: 'ARG_PROVENANCE',
        agentId: s.agentId,
        callId,
        tool: call.tool,
        data: {
          argDerivedFromUntrusted: pre.provenance.argDerivedFromUntrusted,
          recipientOrPayeeDerivedFromUntrusted: pre.provenance.recipientOrPayeeDerivedFromUntrusted,
          matches: pre.provenance.matches.map((m) => ({ arg: m.arg, kind: m.kind, segmentId: m.segmentId, untrusted: m.untrusted, start: m.start, end: m.end, method: m.method })),
        },
      });
    }

    const decision = pre.decision;
    ledger.record({
      sessionId: s.id,
      type: 'POLICY_DECISION',
      agentId: s.agentId,
      callId,
      tool: call.tool,
      ruleId: decision.ruleId,
      action: decision.action,
      data: {
        riskLevel: decision.riskLevel,
        reason: decision.reason,
        shadowWouldBlock: decision.shadowWouldBlock,
        firewallMode: decision.firewallMode,
        matchedRules: decision.matchedRules?.map((m) => ({ ruleId: m.ruleId, action: m.action })),
        sessionState: { untrustedIngested: s.state.untrustedIngested, privateDataAccessed: s.state.privateDataAccessed },
        preview: false,
      },
    });

    const blocked = (reasonResult: ToolResult): ExecutionOutcome => {
      ledger.record({
        sessionId: s.id,
        type: 'TOOL_BLOCKED',
        agentId: s.agentId,
        callId,
        tool: call.tool,
        ruleId: decision.ruleId,
        action: 'blocked',
        data: { reason: decision.reason, ...dest, wouldHaveSentClasses: validated.ok && typeof call.args.body === 'string' ? classifyData(call.args.body) : {} },
      });
      return { status: 'blocked', callId, sessionId: s.id, decision, provenance: pre.provenance, toolResult: reasonResult, toolCall: call, notes };
    };

    if (decision.action === 'deny') {
      return blocked({
        success: false,
        error: `Action Gate BLOCKED execution of "${call.tool}" under rule ${decision.ruleId}: ${decision.reason}`,
        executedWith: 'scoped_broker_token',
        credentialInfo: 'No token minted (denied by gate)',
      });
    }

    if (decision.action === 'approve' && validated.ok) {
      const approvalId = `appr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const item: ApprovalItem = {
        id: approvalId,
        sessionId: s.id,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60 * 1000,
        scenarioId: s.scenarioId ?? 'gateway',
        agentId: s.agentId,
        callId,
        toolCall: call,
        argsHash: hashArgs(call.args),
        riskLevel: decision.riskLevel,
        reason: decision.reason,
        ruleId: decision.ruleId,
        status: 'PENDING',
      };
      this.approvals.set(approvalId, item);
      decision.requiredApprovalId = approvalId;
      ledger.record({
        sessionId: s.id,
        type: 'APPROVAL_QUEUED',
        agentId: s.agentId,
        callId,
        tool: call.tool,
        ruleId: decision.ruleId,
        action: 'pending',
        data: { approvalId, expiresAt: new Date(item.expiresAt).toISOString(), argsHash: item.argsHash, ...dest },
      });
      return {
        status: 'pending_approval',
        callId,
        sessionId: s.id,
        decision,
        provenance: pre.provenance,
        approvalId,
        toolCall: call,
        notes,
        toolResult: {
          success: false,
          error: `Action Gate: "${call.tool}" is held in the approval queue (${approvalId}). Human approval required within 60s.`,
          executedWith: 'scoped_broker_token',
          credentialInfo: 'Pending human approval',
        },
      };
    }

    const result = this.executeAllowed(s, call, callId, undefined, notes);
    return {
      status: result.success ? 'executed' : 'failed',
      callId,
      sessionId: s.id,
      decision,
      provenance: pre.provenance,
      toolResult: result,
      toolCall: call,
      notes,
    };
  }

  /** Mint (or, for the labelled legacy simulation, present a standing key) and execute. */
  private executeAllowed(s: SessionRecord, call: ToolCall, callId: string, approvalId: string | undefined, notes: string[]): ToolResult {
    const { ledger, broker, toolServer, legacy } = this.deps;
    let result: ToolResult;
    let jti: string | undefined;
    if (s.firewallMode === 'off') {
      result = legacy.execute(call, toolServer, s.id);
      notes.push(`${LEGACY_LABEL}: a standing key was used with no argument restrictions or expiry.`);
    } else {
      try {
        // The token string stays inside this function: it is never returned, logged or stored.
        const { token, claims } = broker.issueToken({ sessionId: s.id, agentId: s.agentId, toolCall: call, approvalId });
        jti = claims.jti;
        result = toolServer.executeTool({ toolCall: call, credential: token, sessionId: s.id });
      } catch (err) {
        result = {
          success: false,
          error: `Credential broker refused: ${err instanceof Error ? err.message : String(err)}`,
          executedWith: 'scoped_broker_token',
          credentialInfo: 'No token minted',
        };
      }
    }
    recordToolResult(s.state, call, result);

    const dest = destinationsOf(call);
    if (result.success) {
      const isRead = result.data !== undefined && (call.tool === 'read_candidate_files' || call.tool === 'lookup_order');
      const classText = isRead ? JSON.stringify(result.data) : typeof call.args.body === 'string' ? call.args.body : '';
      const data = result.data as Record<string, unknown> | undefined;
      ledger.record({
        sessionId: s.id,
        type: 'TOOL_EXECUTED',
        agentId: s.agentId,
        callId,
        tool: call.tool,
        action: 'executed',
        data: {
          approvalId,
          jti,
          dataObjectsReferencedInBody: typeof call.args.body === 'string' ? s.state.dataObjects.filter((id) => (call.args.body as string).includes(id)).length : 0,
          executedWith: result.executedWith,
          simulation: result.simulation,
          ...dest,
          bytes: typeof data?.bytesSent === 'number' ? data.bytesSent : undefined,
          recordId: (data?.messageId ?? data?.refundId) as string | undefined,
          providerReceipt: data?.providerReceipt as string | undefined,
          dataObjects: isRead ? collectDataObjects(result.data) : [],
          recordCount: isRead ? countRecords(result.data) : 0,
          dataClasses: classText ? classifyData(classText) : {},
          readsPrivateData: isRead,
        },
      });
    } else {
      ledger.record({
        sessionId: s.id,
        type: 'TOOL_BLOCKED',
        agentId: s.agentId,
        callId,
        tool: call.tool,
        action: 'failed',
        data: { reason: result.error, approvalId, jti, ...dest },
      });
    }
    return result;
  }

  // ------------------------------------------------------------------ approvals

  public getApproval(id: string): ApprovalItem | undefined {
    return this.approvals.get(id);
  }

  public pendingApprovals(): ApprovalItem[] {
    return Array.from(this.approvals.values()).filter((a) => a.status === 'PENDING');
  }

  public allApprovals(): ApprovalItem[] {
    return Array.from(this.approvals.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public expireApprovals(now = Date.now()): number {
    let n = 0;
    for (const item of this.approvals.values()) {
      if (item.status === 'PENDING' && now > item.expiresAt) {
        item.status = 'EXPIRED';
        item.decisionNotes = 'Auto-denied: 60-second human approval window elapsed';
        item.result = { success: false, error: 'Approval expired', executedWith: 'scoped_broker_token', credentialInfo: 'Expired' };
        this.deps.ledger.record({
          sessionId: item.sessionId,
          type: 'APPROVAL_RESOLVED',
          agentId: item.agentId,
          callId: item.callId,
          tool: item.toolCall.tool,
          action: 'expired',
          data: { approvalId: item.id, status: 'EXPIRED' },
        });
        this.deps.onApprovalResolved?.(item, item.result);
        n++;
      }
    }
    return n;
  }

  public resolveApproval(approvalId: string, action: 'APPROVE' | 'DENY', notes?: string): { success: boolean; toolResult?: ToolResult; error?: string } {
    const item = this.approvals.get(approvalId);
    if (!item) return { success: false, error: 'Approval item not found' };
    if (item.status !== 'PENDING') return { success: false, error: `Approval item is already ${item.status}` };
    if (Date.now() > item.expiresAt) {
      this.expireApprovals();
      return { success: false, error: 'Approval item has expired (60s limit)' };
    }
    item.status = action === 'APPROVE' ? 'APPROVED' : 'DENIED';
    item.decisionNotes = notes || (action === 'APPROVE' ? 'Approved by human reviewer' : 'Denied by human reviewer');
    this.deps.ledger.record({
      sessionId: item.sessionId,
      type: 'APPROVAL_RESOLVED',
      agentId: item.agentId,
      callId: item.callId,
      tool: item.toolCall.tool,
      action: item.status.toLowerCase(),
      data: { approvalId, status: item.status, decisionNotes: item.decisionNotes, argsHash: item.argsHash },
    });

    const agentId = item.agentId ?? `agent_${item.scenarioId}`;
    const s = this.sessions.get(item.sessionId);
    let toolResult: ToolResult;
    if (action === 'DENY') {
      toolResult = { success: false, error: 'Execution denied by human reviewer in Approval Queue.', executedWith: 'scoped_broker_token', credentialInfo: 'Denied by human reviewer' };
      this.deps.ledger.record({ sessionId: item.sessionId, type: 'TOOL_BLOCKED', agentId, callId: item.callId, tool: item.toolCall.tool, action: 'denied_by_human', data: { reason: toolResult.error, approvalId } });
    } else if (this.deps.isQuarantined(agentId)) {
      toolResult = { success: false, error: `Agent "${agentId}" is quarantined by the kill switch; approval cannot mint a credential.`, executedWith: 'scoped_broker_token', credentialInfo: 'Blocked by kill switch' };
      this.deps.ledger.record({ sessionId: item.sessionId, type: 'TOOL_BLOCKED', agentId, callId: item.callId, tool: item.toolCall.tool, action: 'quarantined', data: { reason: toolResult.error, approvalId } });
    } else if (!s) {
      toolResult = { success: false, error: 'Session no longer available', executedWith: 'scoped_broker_token', credentialInfo: 'No token minted' };
    } else {
      // approved calls always go through the real token path, even if the session ran in shadow/off mode
      const prevMode = s.firewallMode;
      if (prevMode === 'off') s.firewallMode = 'enforce';
      try {
        toolResult = this.executeAllowed(s, item.toolCall, item.callId ?? `call_${approvalId}`, approvalId, []);
      } finally {
        s.firewallMode = prevMode;
      }
    }
    item.result = toolResult;
    this.deps.onApprovalResolved?.(item, toolResult);
    return { success: true, toolResult };
  }

  public reset(): void {
    this.sessions.clear();
    this.approvals.clear();
  }
}

export interface ExecutionStack extends ExecutionDeps {
  service: ExecutionService;
}

/** Builds a fully wired, isolated stack (own ledger observer, broker, verifier, tool server, policy). */
export function createExecutionStack(opts: {
  ledger: EventLedger;
  engine?: PolicyEngine;
  vault?: Vault;
  broker?: CredentialBroker;
  now?: () => number;
  isQuarantined?: (agentId: string) => boolean;
}): ExecutionStack {
  const obs = opts.ledger.credentialObserver();
  const broker = opts.broker ?? new CredentialBroker({ quiet: true, now: opts.now });
  broker.observer = obs;
  const verifier = new TokenVerifier(broker.createPublicView(), broker.createPublicView(), {
    now: opts.now,
    observer: { ...obs, onRedeemed: (c) => { broker.markRedeemed(c.jti); obs.onRedeemed?.(c); } },
  });
  const toolServer = new ProtectedToolServer(verifier, opts.vault ?? new Vault());
  const deps: ExecutionDeps = {
    ledger: opts.ledger,
    broker,
    verifier,
    toolServer,
    engine: opts.engine ?? new PolicyEngine(),
    legacy: new LegacyStandingKeyDemo(),
    isQuarantined: opts.isQuarantined ?? (() => false),
  };
  return { ...deps, service: new ExecutionService(deps) };
}
