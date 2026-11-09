import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, RefreshCw, ShieldCheck, Search, X } from 'lucide-react';
import { fetchCredentialDetail, fetchCredentialInventory, fetchCredentialLedger, rotateSigningKey, setTokenTtl } from '../../services/api.ts';

const STATUS_STYLE: Record<string, string> = {
  active: 'text-[#ffb020]',
  redeemed: 'text-[#00f5a0]',
  expired: 'text-slate-400',
  revoked: 'text-[#a855f7]',
  rejected: 'text-[#ff365d]',
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

  const input = 'bg-[#090d18] border border-[#00e5ff]/20 rounded px-2 py-1 text-xs text-slate-200 font-mono';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold font-heading text-white uppercase tracking-wide flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#00e5ff]" />
          Credentials · No Standing Credentials
          <span className="text-3xs font-mono text-[#00f5a0] bg-[#00f5a0]/10 border border-[#00f5a0]/30 px-2 py-0.5 rounded">[BUILT: one-time Ed25519 tokens]</span>
        </h2>
        <p className="text-xs text-[#8293aa] mt-0.5">
          Agents never hold tool credentials. A one-time token is minted per approved call, bound to tool, session and the exact arguments, and redeemed inside the gateway.
          Upstream secrets live only in the broker vault module.
        </p>
      </div>

      {notice && <div className="p-2.5 bg-[#00e5ff]/10 border border-[#00e5ff]/30 text-[#00e5ff] rounded text-xs font-mono">{notice}</div>}

      {inv && (
        <div className="p-3 bg-[#0b1329] border border-slate-800 rounded-lg flex flex-wrap items-end gap-4 text-xs font-mono text-slate-300">
          <div>
            Signing key id: <span className="text-white">{inv.broker.kid}</span>
          </div>
          <label className="flex items-center gap-2">
            Token TTL (s, max {inv.broker.maxTtlSeconds})
            <input type="number" min={1} max={inv.broker.maxTtlSeconds} className={`${input} w-20`} value={ttl} onChange={(e) => setTtl(Number(e.target.value))} />
            <button
              type="button"
              className="px-2 py-1 bg-[#00e5ff] text-[#080b12] font-bold rounded"
              onClick={() => setTokenTtl(ttl).then((r) => { setNotice(`TTL set to ${r.ttlSeconds}s for newly issued tokens.`); loadInventory(); }).catch((e) => setNotice(String(e.message ?? e)))}
            >
              Set TTL
            </button>
          </label>
          <button
            type="button"
            className="px-3 py-1 border border-[#a855f7]/50 text-[#d8b4fe] rounded flex items-center gap-1.5"
            onClick={() => rotateSigningKey().then((r) => { setNotice(`Rotated signing key ${r.oldKid} → ${r.newKid}. ${r.note}`); loadInventory(); }).catch((e) => setNotice(String(e.message ?? e)))}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Rotate signing key
          </button>
          <div className="text-3xs text-slate-500 max-w-md">{inv.broker.process}</div>
        </div>
      )}

      <div className="flex gap-2 text-xs">
        {(['inventory', 'ledger'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`px-3 py-1.5 rounded font-mono ${tab === t ? 'bg-[#00e5ff] text-[#080b12] font-bold' : 'bg-[#0b1329] text-slate-300 border border-slate-700'}`}>
            {t === 'inventory' ? 'Standing Credentials Inventory' : 'Credential Ledger'}
          </button>
        ))}
      </div>

      {tab === 'inventory' && inv && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-[#0b1329] border border-[#00f5a0]/30 rounded-lg">
              <div className="text-3xs text-slate-400">Standing tool credentials (all agents)</div>
              <div className="text-2xl font-bold text-[#00f5a0]">{inv.totals.standingToolCredentials}</div>
            </div>
            <div className="p-3 bg-[#0b1329] border border-slate-800 rounded-lg">
              <div className="text-3xs text-slate-400">Outstanding one-time tokens</div>
              <div className="text-2xl font-bold text-white">{inv.totals.outstandingTokens}</div>
            </div>
            <div className="p-3 bg-[#0b1329] border border-[#ff365d]/30 rounded-lg">
              <div className="text-3xs text-slate-400">Legacy pattern (simulation): standing unscoped keys</div>
              <div className="text-2xl font-bold text-[#ff365d]">{inv.totals.legacyStandingKeys}</div>
            </div>
          </div>
          <div className="bg-[#0b1329] border border-slate-800 rounded-lg overflow-x-auto">
            <table className="w-full text-3xs font-mono text-slate-300">
              <thead className="text-slate-500 text-left">
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
                  <tr key={a.agentId} className="border-t border-slate-800">
                    <td className="p-2">{a.agentId}<div className="text-slate-500">{a.appName}</div></td>
                    <td className="p-2 text-[#00f5a0] font-bold">{a.standingToolCredentials}</td>
                    <td className="p-2">{a.outstandingTokens}</td>
                    <td className="p-2">{a.tokensIssued}</td>
                    <td className="p-2">{a.redeemed}</td>
                    <td className="p-2">{a.rejected}</td>
                    <td className="p-2">{a.revoked}</td>
                    <td className="p-2">{a.expired}</td>
                    <td className="p-2">{a.quarantined ? 'QUARANTINED' : 'active'}</td>
                    <td className="p-2 text-[#ff365d]">
                      {a.legacySimulation.standingKeysHeld} key · {a.legacySimulation.toolsUnlocked} tool(s) · unscoped · no expiry
                      {a.legacySimulation.usesObserved ? ` · used ${a.legacySimulation.usesObserved}x` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-[#0b1329] border border-slate-800 rounded-lg text-xs text-slate-300">
            <div className="font-bold text-white mb-1 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#00f5a0]" /> Broker vault (values are never shown)</div>
            <ul className="font-mono text-3xs space-y-0.5">
              {inv.vault.map((v: any) => (
                <li key={v.name}>
                  {v.name} · source {v.source} · held by {v.heldBy} · exposed to agents: {String(v.exposedToAgents)} · used {v.useCount}x
                </li>
              ))}
            </ul>
            <div className="mt-2 text-3xs text-slate-400">
              Exposure scan: {inv.exposureScan.scanned.incidents} incidents, {inv.exposureScan.scanned.ledgerEvents} ledger events, {inv.exposureScan.scanned.auditEntries} audit entries, {inv.exposureScan.scanned.outbox} outbox and {inv.exposureScan.scanned.refunds} refund records checked: {inv.exposureScan.leaks.length} leak(s) found.
            </div>
            <div className="mt-1 text-3xs text-slate-500">{inv.honesty}</div>
          </div>
        </div>
      )}

      {tab === 'ledger' && (
        <div className="space-y-3">
          <div className="p-3 bg-[#0b1329] border border-slate-800 rounded-lg flex flex-wrap items-end gap-2">
            <label className="text-3xs text-slate-400">
              Search (jti, session, tool, approval…)
              <div className="flex items-center gap-1"><Search className="w-3.5 h-3.5 text-slate-500" /><input className={`${input} w-56`} value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></div>
            </label>
            <label className="text-3xs text-slate-400">
              Status
              <select className={`${input} block`} value={filters.status} onChange={(e) => { setPage(1); setFilters({ ...filters, status: e.target.value }); }}>
                {['', 'active', 'redeemed', 'expired', 'revoked', 'rejected'].map((s) => <option key={s} value={s}>{s || 'any'}</option>)}
              </select>
            </label>
            <label className="text-3xs text-slate-400">
              Agent
              <input className={`${input} block`} value={filters.agentId} onChange={(e) => setFilters({ ...filters, agentId: e.target.value })} />
            </label>
            <label className="text-3xs text-slate-400">
              Tool
              <input className={`${input} block`} value={filters.tool} onChange={(e) => setFilters({ ...filters, tool: e.target.value })} />
            </label>
            <button type="button" className="px-3 py-1.5 bg-[#00e5ff] text-[#080b12] font-bold rounded text-xs" onClick={() => { setPage(1); loadLedger(); }}>Apply</button>
          </div>

          {ledger && (
            <>
              <div className="text-3xs font-mono text-slate-400">
                issued {ledger.counts.issued} · active {ledger.counts.active} · redeemed {ledger.counts.redeemed} · expired {ledger.counts.expired} · revoked {ledger.counts.revoked} · rejected presentations {ledger.counts.rejected}
              </div>
              <div className="bg-[#0b1329] border border-slate-800 rounded-lg overflow-x-auto">
                <table className="w-full text-3xs font-mono text-slate-300">
                  <thead className="text-slate-500 text-left">
                    <tr><th className="p-2">jti</th><th className="p-2">agent</th><th className="p-2">tool</th><th className="p-2">session</th><th className="p-2">approval</th><th className="p-2">issued</th><th className="p-2">status</th><th className="p-2">rejected tries</th></tr>
                  </thead>
                  <tbody>
                    {ledger.tokens.map((t: any) => (
                      <tr key={t.jti} className="border-t border-slate-800 cursor-pointer hover:bg-[#141f33]" onClick={() => fetchCredentialDetail(t.jti).then(setDrawer).catch((e) => setNotice(String(e)))}>
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
              <div className="bg-[#0b1329] border border-[#ff365d]/30 rounded-lg p-3">
                <div className="text-xs font-bold text-white mb-1">Rejected presentations ({ledger.totalRejections})</div>
                <ul className="font-mono text-3xs text-slate-300 space-y-0.5 max-h-48 overflow-y-auto">
                  {ledger.rejections.map((r: any) => (
                    <li key={r.eventId}><span className="text-[#ff365d]">{r.code}</span> · {r.ts.slice(11, 19)} · {r.tool ?? '?'} · {r.agentId ?? '?'} · {r.reason}</li>
                  ))}
                </ul>
              </div>
              <div className="flex gap-2 text-xs">
                <button type="button" disabled={page <= 1} className="px-2 py-1 border border-slate-700 rounded disabled:opacity-40 text-slate-300" onClick={() => setPage((p) => p - 1)}>Prev</button>
                <button type="button" disabled={page * 20 >= ledger.totalTokens} className="px-2 py-1 border border-slate-700 rounded disabled:opacity-40 text-slate-300" onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </>
          )}
        </div>
      )}

      {drawer && (
        <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-[#080b12] border-l border-[#00e5ff]/30 shadow-2xl z-50 p-4 overflow-y-auto" role="dialog" aria-label="Token detail drawer">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-white">Token {drawer.token.jti.slice(0, 20)}…</div>
            <button type="button" onClick={() => setDrawer(null)} className="text-slate-400"><X className="w-4 h-4" /></button>
          </div>
          <div className="text-xs font-mono text-slate-300 space-y-1">
            <div>status: <span className={STATUS_STYLE[drawer.token.status]}>{drawer.token.status}</span></div>
            <div>agent (sub): {drawer.token.agentId}</div>
            <div>session: {drawer.token.sessionId}</div>
            <div>tool: {drawer.token.tool}</div>
            <div>approvalId: {drawer.token.approvalId ?? '-'}</div>
            <div>argsHash: {drawer.token.argsHash}</div>
            <div>issued: {drawer.token.issuedAt} · expires: {drawer.token.expiresAt}</div>
            {drawer.token.revokedReason && <div>revoked: {drawer.token.revokedReason}</div>}
            <div className="text-slate-500">The token string itself is never stored or shown.</div>
          </div>
          <div className="mt-3 text-xs font-bold text-white">Lifecycle events</div>
          <ul className="mt-1 space-y-2">
            {drawer.events.map((e: any) => (
              <li key={e.id} className="p-2 border border-slate-800 rounded text-3xs font-mono text-slate-300">
                <div className="text-[#00e5ff]">{e.type} · {e.ts.slice(11, 23)}</div>
                <pre className="whitespace-pre-wrap break-all text-slate-400">{JSON.stringify(e.data, null, 1)}</pre>
                <div className="text-slate-500">audit entry #{e.auditSeq}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
