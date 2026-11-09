import type { LedgerEvent } from './ledger.ts';
import type { Vault, VaultStatus } from './vault.ts';

/**
 * Credential ledger + standing-credentials inventory, computed from ledger events.
 * No token string is ever stored or shown: only jti, claims metadata and lifecycle events.
 */
export type TokenStatus = 'active' | 'redeemed' | 'expired' | 'revoked';

export interface TokenRecord {
  jti: string;
  agentId: string;
  sessionId: string;
  tool?: string;
  approvalId?: string;
  argsHash?: string;
  ttlSeconds?: number;
  issuedAt: string;
  expiresAt: string;
  status: TokenStatus;
  redeemedAt?: string;
  revokedAt?: string;
  revokedReason?: string;
  rejectedAttempts: number;
  eventIds: string[];
}

export interface RejectionRecord {
  eventId: string;
  ts: string;
  code: string;
  reason: string;
  tool?: string;
  sessionId: string;
  requestedSession?: string;
  jti?: string;
  agentId?: string;
}

export interface CredentialLedgerQuery {
  search?: string;
  status?: string;
  agentId?: string;
  tool?: string;
  sessionId?: string;
  page?: number;
  pageSize?: number;
}

export function aggregateTokens(events: LedgerEvent[], nowMs: number = Date.now()): { tokens: TokenRecord[]; rejections: RejectionRecord[] } {
  const map = new Map<string, TokenRecord>();
  const rejections: RejectionRecord[] = [];
  for (const e of events) {
    if (!e.type.startsWith('TOKEN_')) continue;
    const jti = e.data.jti as string | undefined;
    if (e.type === 'TOKEN_ISSUED' && jti) {
      map.set(jti, {
        jti,
        agentId: String(e.data.sub ?? e.agentId ?? 'unknown'),
        sessionId: e.sessionId,
        tool: e.tool,
        approvalId: e.data.approvalId as string | undefined,
        argsHash: e.data.argsHash as string | undefined,
        ttlSeconds: e.data.ttlSeconds as number | undefined,
        issuedAt: e.ts,
        expiresAt: new Date(Number(e.data.exp) * 1000).toISOString(),
        status: 'active',
        rejectedAttempts: 0,
        eventIds: [e.id],
      });
      continue;
    }
    const t = jti ? map.get(jti) : undefined;
    if (e.type === 'TOKEN_REJECTED') {
      rejections.push({
        eventId: e.id,
        ts: e.ts,
        code: String(e.data.code ?? ''),
        reason: String(e.data.reason ?? ''),
        tool: e.tool,
        sessionId: e.sessionId,
        requestedSession: e.data.requestedSession as string | undefined,
        jti,
        agentId: e.agentId,
      });
      if (t) {
        t.rejectedAttempts++;
        t.eventIds.push(e.id);
      }
      continue;
    }
    if (!t) continue;
    t.eventIds.push(e.id);
    if (e.type === 'TOKEN_REDEEMED') {
      t.status = 'redeemed';
      t.redeemedAt = e.ts;
    } else if (e.type === 'TOKEN_REVOKED') {
      if (t.status !== 'redeemed') t.status = 'revoked';
      t.revokedAt = e.ts;
      t.revokedReason = String(e.data.reason ?? '');
    } else if (e.type === 'TOKEN_EXPIRED') {
      if (t.status === 'active') t.status = 'expired';
    }
  }
  for (const t of map.values()) if (t.status === 'active' && Date.parse(t.expiresAt) < nowMs) t.status = 'expired';
  return { tokens: Array.from(map.values()).reverse(), rejections: rejections.reverse() };
}

export function queryCredentialLedger(events: LedgerEvent[], q: CredentialLedgerQuery = {}, nowMs: number = Date.now()) {
  const { tokens, rejections } = aggregateTokens(events, nowMs);
  const search = q.search?.toLowerCase();
  const match = (t: TokenRecord) =>
    (!q.status || t.status === q.status || (q.status === 'rejected' && t.rejectedAttempts > 0)) &&
    (!q.agentId || t.agentId === q.agentId) &&
    (!q.tool || t.tool === q.tool) &&
    (!q.sessionId || t.sessionId === q.sessionId) &&
    (!search || JSON.stringify(t).toLowerCase().includes(search));
  const filtered = q.status === 'rejected_only' ? [] : tokens.filter(match);
  const rej = rejections.filter(
    (r) =>
      (!q.status || q.status === 'rejected' || q.status === 'rejected_only') &&
      (!q.agentId || r.agentId === q.agentId) &&
      (!q.tool || r.tool === q.tool) &&
      (!q.sessionId || r.sessionId === q.sessionId || r.requestedSession === q.sessionId) &&
      (!search || JSON.stringify(r).toLowerCase().includes(search))
  );
  const pageSize = Math.min(Math.max(q.pageSize ?? 25, 1), 200);
  const page = Math.max(q.page ?? 1, 1);
  const counts = {
    issued: tokens.length,
    active: tokens.filter((t) => t.status === 'active').length,
    redeemed: tokens.filter((t) => t.status === 'redeemed').length,
    expired: tokens.filter((t) => t.status === 'expired').length,
    revoked: tokens.filter((t) => t.status === 'revoked').length,
    rejected: rejections.length,
  };
  return { tokens: filtered.slice((page - 1) * pageSize, page * pageSize), totalTokens: filtered.length, rejections: rej.slice(0, 200), totalRejections: rej.length, counts, page, pageSize };
}

export function tokenDetail(events: LedgerEvent[], jti: string, nowMs: number = Date.now()) {
  const token = aggregateTokens(events, nowMs).tokens.find((t) => t.jti === jti);
  if (!token) return null;
  const ids = new Set(token.eventIds);
  return { token, events: events.filter((e) => ids.has(e.id)) };
}

// ----------------------------------------------------------------------------- inventory

export interface ExposureScan {
  scanned: { incidents: number; ledgerEvents: number; auditEntries: number; outbox: number; refunds: number };
  leaks: Array<{ kind: 'vault-secret' | 'token-like-string'; name: string; where: string }>;
}

const TOKEN_LIKE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}/;

/** Looks for upstream secrets and token-shaped strings in everything an agent, log reader or UI could see. */
export function scanForExposure(vault: Vault, artifacts: Record<'incidents' | 'ledgerEvents' | 'auditEntries' | 'outbox' | 'refunds', unknown[]>): ExposureScan {
  const leaks: ExposureScan['leaks'] = [];
  for (const [where, items] of Object.entries(artifacts)) {
    const text = JSON.stringify(items);
    for (const name of vault.findLeaks(text)) leaks.push({ kind: 'vault-secret', name, where });
    if (TOKEN_LIKE.test(text)) leaks.push({ kind: 'token-like-string', name: 'JWT-shaped token', where });
  }
  return {
    scanned: {
      incidents: artifacts.incidents.length,
      ledgerEvents: artifacts.ledgerEvents.length,
      auditEntries: artifacts.auditEntries.length,
      outbox: artifacts.outbox.length,
      refunds: artifacts.refunds.length,
    },
    leaks,
  };
}

export interface AgentInventoryRow {
  agentId: string;
  appName?: string;
  allowedTools: string[];
  /** standing tool credentials reachable by this agent: 0 unless the exposure scan found a leak */
  standingToolCredentials: number;
  outstandingTokens: number;
  tokensIssued: number;
  redeemed: number;
  rejected: number;
  revoked: number;
  expired: number;
  quarantined: boolean;
  legacySimulation: { label: string; standingKeysHeld: number; toolsUnlocked: number; unscoped: true; expires: false; usesObserved: number };
}

export function buildInventory(params: {
  events: LedgerEvent[];
  agents: Array<{ agentId: string; appName?: string; allowedTools: string[] }>;
  isQuarantined: (agentId: string) => boolean;
  exposure: ExposureScan;
  vaultStatus: VaultStatus[];
  legacyLabel: string;
  nowMs?: number;
}) {
  const nowMs = params.nowMs ?? Date.now();
  const { tokens, rejections } = aggregateTokens(params.events, nowMs);
  const known = new Map(params.agents.map((a) => [a.agentId, a]));
  for (const t of tokens) if (!known.has(t.agentId)) known.set(t.agentId, { agentId: t.agentId, allowedTools: [] });
  const leaks = params.exposure.leaks.length;
  const rows: AgentInventoryRow[] = Array.from(known.values()).map((a) => {
    const mine = tokens.filter((t) => t.agentId === a.agentId);
    const legacyUses = params.events.filter((e) => e.type === 'TOOL_EXECUTED' && e.agentId === a.agentId && e.data.executedWith === 'standing_master_key').length;
    return {
      agentId: a.agentId,
      appName: a.appName,
      allowedTools: a.allowedTools,
      standingToolCredentials: leaks,
      outstandingTokens: mine.filter((t) => t.status === 'active').length,
      tokensIssued: mine.length,
      redeemed: mine.filter((t) => t.status === 'redeemed').length,
      rejected: rejections.filter((r) => r.agentId === a.agentId).length,
      revoked: mine.filter((t) => t.status === 'revoked').length,
      expired: mine.filter((t) => t.status === 'expired').length,
      quarantined: params.isQuarantined(a.agentId),
      legacySimulation: { label: params.legacyLabel, standingKeysHeld: 1, toolsUnlocked: a.allowedTools.length, unscoped: true, expires: false, usesObserved: legacyUses },
    };
  });
  return {
    agents: rows,
    totals: {
      standingToolCredentials: rows.reduce((n, r) => n + r.standingToolCredentials, 0),
      legacyStandingKeys: rows.length,
      outstandingTokens: rows.reduce((n, r) => n + r.outstandingTokens, 0),
    },
    vault: params.vaultStatus,
    exposureScan: params.exposure,
    honesty:
      'Upstream secrets live in the broker vault module of this single process. standingToolCredentials is computed from a scan of agent-visible artifacts (incidents, ledger, audit, outbox, refunds) for vault values and token-shaped strings; 0 means none were found, not that a compromised process could not reach the vault.',
  };
}
