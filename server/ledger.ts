import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { AuditHashChain, auditLog } from './auditLog.ts';
import { canonicalJson, sha256Hex } from './canonical.ts';
import type { AuditEntry, ScopedTokenClaims } from './types.ts';
import type { CredentialObserver } from './credentialBroker.ts';

/**
 * The event ledger: every security-relevant step of a session is one event.
 * Each event is committed to the tamper-evident audit chain (digest of the event inside a keyed
 * hash-chain entry), and persisted as JSONL so a restart keeps it. Blast radius, replay, evidence
 * bundles, the logs page and the credential ledger are all computed from these events.
 * Token STRINGS are never stored here (only jti and claims metadata).
 */
export type LedgerEventType =
  | 'SESSION_START'
  | 'SEGMENT_INGESTED'
  | 'FINDINGS_DETECTED'
  | 'LLM_RESPONSE'
  | 'OUTPUT_INSPECTED'
  | 'TOOL_PROPOSED'
  | 'ARG_PROVENANCE'
  | 'POLICY_DECISION'
  | 'APPROVAL_QUEUED'
  | 'APPROVAL_RESOLVED'
  | 'TOKEN_ISSUED'
  | 'TOKEN_REDEEMED'
  | 'TOKEN_REJECTED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_REVOKED'
  | 'KEY_ROTATED'
  | 'TTL_CHANGED'
  | 'TOOL_EXECUTED'
  | 'TOOL_BLOCKED'
  | 'KILL_SWITCH'
  | 'SESSION_END';

export interface LedgerEvent {
  id: string;
  seq: number;
  ts: string;
  sessionId: string;
  type: LedgerEventType;
  agentId?: string;
  callId?: string;
  tool?: string;
  ruleId?: string;
  action?: string;
  data: Record<string, unknown>;
  /** sha256 of the canonical event without digest/auditSeq */
  digest: string;
  /** seq of the audit-chain entry that commits to this event */
  auditSeq: number;
}

export type LedgerEventInput = Omit<LedgerEvent, 'id' | 'seq' | 'ts' | 'digest' | 'auditSeq' | 'data'> & { data?: Record<string, unknown> };

export interface LedgerQuery {
  sessionId?: string;
  type?: string;
  tool?: string;
  ruleId?: string;
  action?: string;
  agentId?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface LedgerOptions {
  dir?: string | null;
  audit?: AuditHashChain;
  now?: () => number;
}

const AUDIT_TYPE: Partial<Record<LedgerEventType, AuditEntry['type']>> = {
  POLICY_DECISION: 'POLICY_DECISION',
  TOKEN_ISSUED: 'TOKEN_ISSUED',
  TOOL_EXECUTED: 'TOOL_INVOCATION',
  TOOL_BLOCKED: 'TOOL_INVOCATION',
  APPROVAL_QUEUED: 'APPROVAL_DECISION',
  APPROVAL_RESOLVED: 'APPROVAL_DECISION',
};

const AUDIT_DATA_FIELDS = ['jti', 'approvalId', 'code', 'status', 'riskLevel', 'kid', 'agentId', 'callId', 'reason'];

export function eventDigest(e: Omit<LedgerEvent, 'digest' | 'auditSeq'>): string {
  return sha256Hex(canonicalJson(e));
}

export class EventLedger {
  private events: LedgerEvent[] = [];
  private audit: AuditHashChain;
  private dir: string | null;
  private now: () => number;
  private counter = 0;
  public badLinesAtLoad = 0;

  constructor(opts: LedgerOptions = {}) {
    this.audit = opts.audit ?? auditLog;
    this.dir = opts.dir ?? null;
    this.now = opts.now ?? Date.now;
    if (this.dir) {
      fs.mkdirSync(this.dir, { recursive: true });
      this.load();
    }
  }

  private get file(): string | null {
    return this.dir ? path.join(this.dir, 'events.jsonl') : null;
  }

  private load(): void {
    const f = this.file;
    if (!f || !fs.existsSync(f)) return;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        this.events.push(JSON.parse(line) as LedgerEvent);
      } catch {
        this.badLinesAtLoad++;
      }
    }
    this.counter = this.events.reduce((m, e) => Math.max(m, e.seq + 1), 0);
  }

  public record(input: LedgerEventInput): LedgerEvent {
    const seq = this.counter++;
    const base: Omit<LedgerEvent, 'digest' | 'auditSeq'> = {
      id: `evt_${seq}_${crypto.randomBytes(3).toString('hex')}`,
      seq,
      ts: new Date(this.now()).toISOString(),
      sessionId: input.sessionId,
      type: input.type,
      ...(input.agentId ? { agentId: input.agentId } : {}),
      ...(input.callId ? { callId: input.callId } : {}),
      ...(input.tool ? { tool: input.tool } : {}),
      ...(input.ruleId ? { ruleId: input.ruleId } : {}),
      ...(input.action ? { action: input.action } : {}),
      data: input.data ?? {},
    };
    const digest = eventDigest(base);
    const picked: Record<string, unknown> = {};
    for (const k of AUDIT_DATA_FIELDS) if (base.data[k] !== undefined) picked[k] = base.data[k];
    const entry = this.audit.appendEntry({
      type: AUDIT_TYPE[input.type] ?? 'LEDGER_EVENT',
      sessionId: input.sessionId,
      data: {
        ...picked,
        eventId: base.id,
        eventType: input.type,
        digest,
        ...(input.tool ? { tool: input.tool } : {}),
        ...(input.ruleId ? { ruleId: input.ruleId } : {}),
        action: input.action ?? input.type.toLowerCase(),
      },
    });
    const event: LedgerEvent = { ...base, digest, auditSeq: entry.seq };
    this.events.push(event);
    if (this.file) fs.appendFileSync(this.file, JSON.stringify(event) + '\n');
    return event;
  }

  public all(): LedgerEvent[] {
    return [...this.events];
  }

  public bySession(sessionId: string): LedgerEvent[] {
    return this.events.filter((e) => e.sessionId === sessionId);
  }

  public query(q: LedgerQuery = {}): { items: LedgerEvent[]; total: number; page: number; pageSize: number } {
    const search = q.search?.toLowerCase();
    const from = q.from ? Date.parse(q.from) : undefined;
    const to = q.to ? Date.parse(q.to) : undefined;
    const items = this.events
      .filter((e) => {
        if (q.sessionId && e.sessionId !== q.sessionId) return false;
        if (q.type && e.type !== q.type) return false;
        if (q.tool && e.tool !== q.tool) return false;
        if (q.ruleId && e.ruleId !== q.ruleId) return false;
        if (q.action && e.action !== q.action) return false;
        if (q.agentId && e.agentId !== q.agentId) return false;
        const t = Date.parse(e.ts);
        if (from !== undefined && !Number.isNaN(from) && t < from) return false;
        if (to !== undefined && !Number.isNaN(to) && t > to) return false;
        if (search && !JSON.stringify(e).toLowerCase().includes(search)) return false;
        return true;
      })
      .reverse();
    const pageSize = Math.min(Math.max(q.pageSize ?? 25, 1), 500);
    const page = Math.max(q.page ?? 1, 1);
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
  }

  /** Each event's digest must match the digest committed in its audit-chain entry. */
  public verify(): { ok: boolean; checked: number; mismatches: Array<{ eventId: string; reason: string }> } {
    const mismatches: Array<{ eventId: string; reason: string }> = [];
    for (const e of this.events) {
      const { digest, auditSeq, ...rest } = e;
      if (eventDigest(rest) !== digest) {
        mismatches.push({ eventId: e.id, reason: 'event content does not match its digest' });
        continue;
      }
      const entry = this.audit.getEntry(auditSeq);
      const d = entry?.data as Record<string, unknown> | undefined;
      if (!entry || d?.eventId !== e.id || d?.digest !== digest) {
        mismatches.push({ eventId: e.id, reason: entry ? 'audit entry does not commit to this event' : 'audit entry missing' });
      }
    }
    return { ok: mismatches.length === 0, checked: this.events.length, mismatches };
  }

  /** Archives (never deletes) the persisted file and starts empty. */
  public reset(): void {
    this.events = [];
    this.counter = 0;
    const f = this.file;
    if (f && fs.existsSync(f)) fs.renameSync(f, `${f}.archived-${Date.now()}`);
  }

  /** Credential lifecycle events from the broker / verifier become ledger events. */
  public credentialObserver(defaults: { agentId?: string } = {}): CredentialObserver {
    const claimsData = (c: ScopedTokenClaims) => ({
      jti: c.jti,
      sub: c.sub,
      argsHash: c.argsHash,
      approvalId: c.approvalId,
      iat: c.iat,
      exp: c.exp,
      aud: c.aud,
    });
    return {
      onIssued: (c, ttl) =>
        this.record({ sessionId: c.sessionId, type: 'TOKEN_ISSUED', agentId: c.sub, tool: c.tool, action: 'issued', data: { ...claimsData(c), ttlSeconds: ttl } }),
      onRedeemed: (c) =>
        this.record({ sessionId: c.sessionId, type: 'TOKEN_REDEEMED', agentId: c.sub, tool: c.tool, action: 'redeemed', data: claimsData(c) }),
      onRejected: (i) =>
        this.record({
          sessionId: i.claims?.sessionId ?? (i.sessionId || 'unknown'),
          type: 'TOKEN_REJECTED',
          agentId: i.claims?.sub ?? defaults.agentId,
          tool: i.tool,
          action: 'rejected',
          data: { code: i.code, reason: i.error, requestedSession: i.sessionId, ...(i.claims ? claimsData(i.claims) : {}) },
        }),
      onRevoked: (i) =>
        this.record({ sessionId: i.sessionId ?? 'unknown', type: 'TOKEN_REVOKED', agentId: i.sub, tool: i.tool, action: 'revoked', data: { jti: i.jti, sub: i.sub, reason: i.reason } }),
      onExpired: (i) =>
        this.record({ sessionId: i.sessionId, type: 'TOKEN_EXPIRED', agentId: i.sub, tool: i.tool, action: 'expired', data: { jti: i.jti, sub: i.sub, reason: 'expired without being redeemed' } }),
      onKeyRotated: (i) =>
        this.record({ sessionId: 'credential_admin', type: 'KEY_ROTATED', action: 'rotated', data: { kid: i.newKid, oldKid: i.oldKid } }),
    };
  }
}

export const eventLedger = new EventLedger({ dir: process.env.AUDIT_DIR || path.resolve(process.cwd(), '.audit') });
