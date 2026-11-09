import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, RefreshCw, ShieldCheck, Search, X } from 'lucide-react';
import { fetchCredentialDetail, fetchCredentialInventory, fetchCredentialLedger, rotateSigningKey, setTokenTtl } from '../../services/api.ts';

const STATUS_STYLE: Record<string, string> = {
  active: 'text-warn',
  redeemed: 'text-ok',
  expired: 'text-muted',
  revoked: 'text-info',
  rejected: 'text-danger',
};

/** No standing credentials: inventory per agent (vs the legacy simulation) + credential ledger. */
export const CredentialsPage: React.FC = () => {
  const [tab, setTab] = useState<'inventory' | 'ledger'>('inventory');
  const [inv, setInv] = useState<any | null>(null);
  const [ledger, setLedger] = useState<any | null>(null);
  const [filters, setFilters] = useState<{ search: string; status: string; agentId: string; tool: string }>({ search: '', status: '', agentId: '', tool: '' });
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState<any | null>(null);
  const [ttl, setTtl] = useState<number>(60);
  const [notice, setNotice] = useState<string | null>(null);

  const loadInventory = useCallback(async () => {
    try {
      const d = await fetchCredentialInventory();
      setInv(d);
      setTtl(d.broker.ttlSeconds);
    } catch (e) {
      setNotice(String(e));
    }
  }, []);
  const loadLedger = useCallback(async () => {
    try {
      setLedger(await fetchCredentialLedger({ ...filters, page, pageSize: 20 }));
    } catch (e) {
      setNotice(String(e));
    }
  }, [filters, page]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);
  useEffect(() => {
    if (tab === 'ledger') loadLedger();
  }, [tab, loadLedger]);

  const input = 'bg-surface border border-line rounded px-2 py-1 text-xs text-fg font-mono';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-fg uppercase tracking-wide flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-accent" />
          Credentials · No Standing Credentials
          <span className="text-3xs font-mono text-ok bg-ok-solid/10 border border-ok-solid/40 px-2 py-0.5 rounded">[BUILT: one-time Ed25519 tokens]</span>
        </h2>
        <p className="text-xs text-muted mt-0.5">
          Agents never hold tool credentials. A one-time token is minted per approved call, bound to tool, session and the exact arguments, and redeemed inside the gateway.
          Upstream secrets live only in the broker vault module.
        </p>
      </div>

      {notice && <div className="p-2.5 bg-accent-solid/10 border border-line-strong text-accent rounded text-xs font-mono">{notice}</div>}

      {inv && (
        <div className="p-3 bg-subtle border border-line rounded-lg flex flex-wrap items-end gap-4 text-xs font-mono text-fg2">
          <div>
            Signing key id: <span className="text-fg">{inv.broker.kid}</span>
          </div>
          <label className="flex items-center gap-2">
            Token TTL (s, max {inv.broker.maxTtlSeconds})
            <input type="number" min={1} max={inv.broker.maxTtlSeconds} className={`${input} w-20`} value={ttl} onChange={(e) => setTtl(Number(e.target.value))} />
            <button
              type="button"
              className="px-2 py-1 bg-accent-solid text-on-solid font-bold rounded"
              onClick={() => setTokenTtl(ttl).then((r) => { setNotice(`TTL set to ${r.ttlSeconds}s for newly issued tokens.`); loadInventory(); }).catch((e) => setNotice(String(e.message ?? e)))}
            >
              Set TTL
            </button>
          </label>
          <button
            type="button"
            className="px-3 py-1 border border-info-solid/40 text-info rounded flex items-center gap-1.5"
            onClick={() => rotateSigningKey().then((r) => { setNotice(`Rotated signing key ${r.oldKid} → ${r.newKid}. ${r.note}`); loadInventory(); }).catch((e) => setNotice(String(e.message ?? e)))}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Rotate signing key
          </button>
          <div className="text-3xs text-muted max-w-md">{inv.broker.process}</div>
        </div>
      )}

      <div className="flex gap-2 text-xs">
        {(['inventory', 'ledger'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`px-3 py-1.5 rounded font-mono ${tab === t ? 'bg-accent-solid text-on-solid font-bold' : 'bg-subtle text-fg2 border border-line-strong'}`}>
            {t === 'inventory' ? 'Standing Credentials Inventory' : 'Credential Ledger'}
          </button>
        ))}
      </div>

      {tab === 'inventory' && inv && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-subtle border border-ok-solid/40 rounded-lg">
              <div className="text-3xs text-muted">Standing tool credentials (all agents)</div>
              <div className="text-2xl font-bold text-ok">{inv.totals.standingToolCredentials}</div>
            </div>
            <div className="p-3 bg-subtle border border-line rounded-lg">
              <div className="text-3xs text-muted">Outstanding one-time tokens</div>
              <div className="text-2xl font-bold text-fg">{inv.totals.outstandingTokens}</div>
            </div>
            <div className="p-3 bg-subtle border border-danger-solid/40 rounded-lg">
              <div className="text-3xs text-muted">Legacy pattern (simulation): standing unscoped keys</div>
              <div className="text-2xl font-bold text-danger">{inv.totals.legacyStandingKeys}</div>
            </div>
          </div>
          <div className="bg-subtle border border-line rounded-lg overflow-x-auto">
            <table className="w-full text-3xs font-mono text-fg2">
              <thead className="text-muted text-left">
                <tr>
                  <th className="p-2">agent</th>
                  <th className="p-2">standing creds</th>
                  <th className="p-2">outstanding</th>
                  <th className="p-2">issued</th>
                  <th className="p-2">redeemed</th>
                  <th className="p-2">rejected</th>
                  <th className="p-2">revoked</th>
                  <th className="p-2">expired</th>
                  <th className="p-2">state</th>
                  <th className="p-2">{inv.agents[0]?.legacySimulation.label ?? 'Simulation of the legacy pattern'}</th>
                </tr>
              </thead>
              <tbody>
                {inv.agents.map((a: any) => (
                  <tr key={a.agentId} className="border-t border-line">
                    <td className="p-2">{a.agentId}<div className="text-muted">{a.appName}</div></td>
                    <td className="p-2 text-ok font-bold">{a.standingToolCredentials}</td>
                    <td className="p-2">{a.outstandingTokens}</td>
                    <td className="p-2">{a.tokensIssued}</td>
                    <td className="p-2">{a.redeemed}</td>
                    <td className="p-2">{a.rejected}</td>
                    <td className="p-2">{a.revoked}</td>
                    <td className="p-2">{a.expired}</td>
                    <td className="p-2">{a.quarantined ? 'QUARANTINED' : 'active'}</td>
                    <td className="p-2 text-danger">
                      {a.legacySimulation.standingKeysHeld} key · {a.legacySimulation.toolsUnlocked} tool(s) · unscoped · no expiry
                      {a.legacySimulation.usesObserved ? ` · used ${a.legacySimulation.usesObserved}x` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-subtle border border-line rounded-lg text-xs text-fg2">
            <div className="font-bold text-fg mb-1 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-ok" /> Broker vault (values are never shown)</div>
            <ul className="font-mono text-3xs space-y-0.5">
              {inv.vault.map((v: any) => (
                <li key={v.name}>
                  {v.name} · source {v.source} · held by {v.heldBy} · exposed to agents: {String(v.exposedToAgents)} · used {v.useCount}x
                </li>
              ))}
            </ul>
            <div className="mt-2 text-3xs text-muted">
              Exposure scan: {inv.exposureScan.scanned.incidents} incidents, {inv.exposureScan.scanned.ledgerEvents} ledger events, {inv.exposureScan.scanned.auditEntries} audit entries, {inv.exposureScan.scanned.outbox} outbox and {inv.exposureScan.scanned.refunds} refund records checked: {inv.exposureScan.leaks.length} leak(s) found.
            </div>
            <div className="mt-1 text-3xs text-muted">{inv.honesty}</div>
          </div>
        </div>
      )}

      {tab === 'ledger' && (
        <div className="space-y-3">
          <div className="p-3 bg-subtle border border-line rounded-lg flex flex-wrap items-end gap-2">
            <label className="text-3xs text-muted">
              Search (jti, session, tool, approval…)
              <div className="flex items-center gap-1"><Search className="w-3.5 h-3.5 text-muted" /><input className={`${input} w-56`} value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></div>
            </label>
            <label className="text-3xs text-muted">
              Status
              <select className={`${input} block`} value={filters.status} onChange={(e) => { setPage(1); setFilters({ ...filters, status: e.target.value }); }}>
                {['', 'active', 'redeemed', 'expired', 'revoked', 'rejected'].map((s) => <option key={s} value={s}>{s || 'any'}</option>)}
              </select>
            </label>
            <label className="text-3xs text-muted">
              Agent
              <input className={`${input} block`} value={filters.agentId} onChange={(e) => setFilters({ ...filters, agentId: e.target.value })} />
            </label>
            <label className="text-3xs text-muted">
              Tool
              <input className={`${input} block`} value={filters.tool} onChange={(e) => setFilters({ ...filters, tool: e.target.value })} />
            </label>
            <button type="button" className="px-3 py-1.5 bg-accent-solid text-on-solid font-bold rounded text-xs" onClick={() => { setPage(1); loadLedger(); }}>Apply</button>
          </div>

          {ledger && (
            <>
              <div className="text-3xs font-mono text-muted">
                issued {ledger.counts.issued} · active {ledger.counts.active} · redeemed {ledger.counts.redeemed} · expired {ledger.counts.expired} · revoked {ledger.counts.revoked} · rejected presentations {ledger.counts.rejected}
              </div>
              <div className="bg-subtle border border-line rounded-lg overflow-x-auto">
                <table className="w-full text-3xs font-mono text-fg2">
                  <thead className="text-muted text-left">
                    <tr><th className="p-2">jti</th><th className="p-2">agent</th><th className="p-2">tool</th><th className="p-2">session</th><th className="p-2">approval</th><th className="p-2">issued</th><th className="p-2">status</th><th className="p-2">rejected tries</th></tr>
                  </thead>
                  <tbody>
                    {ledger.tokens.map((t: any) => (
                      <tr key={t.jti} className="border-t border-line cursor-pointer hover:bg-raised" onClick={() => fetchCredentialDetail(t.jti).then(setDrawer).catch((e) => setNotice(String(e)))}>
                        <td className="p-2">{t.jti.slice(0, 18)}…</td>
                        <td className="p-2">{t.agentId}</td>
                        <td className="p-2">{t.tool}</td>
                        <td className="p-2 max-w-[140px] truncate">{t.sessionId}</td>
                        <td className="p-2">{t.approvalId ?? '-'}</td>
                        <td className="p-2">{t.issuedAt.slice(11, 19)}</td>
                        <td className={`p-2 font-bold ${STATUS_STYLE[t.status]}`}>{t.status}</td>
                        <td className="p-2">{t.rejectedAttempts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-subtle border border-danger-solid/40 rounded-lg p-3">
                <div className="text-xs font-bold text-fg mb-1">Rejected presentations ({ledger.totalRejections})</div>
                <ul className="font-mono text-3xs text-fg2 space-y-0.5 max-h-48 overflow-y-auto">
                  {ledger.rejections.map((r: any) => (
                    <li key={r.eventId}><span className="text-danger">{r.code}</span> · {r.ts.slice(11, 19)} · {r.tool ?? '?'} · {r.agentId ?? '?'} · {r.reason}</li>
                  ))}
                </ul>
              </div>
              <div className="flex gap-2 text-xs">
                <button type="button" disabled={page <= 1} className="px-2 py-1 border border-line-strong rounded disabled:opacity-40 text-fg2" onClick={() => setPage((p) => p - 1)}>Prev</button>
                <button type="button" disabled={page * 20 >= ledger.totalTokens} className="px-2 py-1 border border-line-strong rounded disabled:opacity-40 text-fg2" onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </>
          )}
        </div>
      )}

      {drawer && (
        <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-canvas border-l border-line-strong shadow-2xl z-50 p-4 overflow-y-auto" role="dialog" aria-label="Token detail drawer">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-fg">Token {drawer.token.jti.slice(0, 20)}…</div>
            <button type="button" onClick={() => setDrawer(null)} className="text-muted"><X className="w-4 h-4" /></button>
          </div>
          <div className="text-xs font-mono text-fg2 space-y-1">
            <div>status: <span className={STATUS_STYLE[drawer.token.status]}>{drawer.token.status}</span></div>
            <div>agent (sub): {drawer.token.agentId}</div>
            <div>session: {drawer.token.sessionId}</div>
            <div>tool: {drawer.token.tool}</div>
            <div>approvalId: {drawer.token.approvalId ?? '-'}</div>
            <div>argsHash: {drawer.token.argsHash}</div>
            <div>issued: {drawer.token.issuedAt} · expires: {drawer.token.expiresAt}</div>
            {drawer.token.revokedReason && <div>revoked: {drawer.token.revokedReason}</div>}
            <div className="text-muted">The token string itself is never stored or shown.</div>
          </div>
          <div className="mt-3 text-xs font-bold text-fg">Lifecycle events</div>
          <ul className="mt-1 space-y-2">
            {drawer.events.map((e: any) => (
              <li key={e.id} className="p-2 border border-line rounded text-3xs font-mono text-fg2">
                <div className="text-accent">{e.type} · {e.ts.slice(11, 23)}</div>
                <pre className="whitespace-pre-wrap break-all text-muted">{JSON.stringify(e.data, null, 1)}</pre>
                <div className="text-muted">audit entry #{e.auditSeq}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
