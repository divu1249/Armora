import React, { useCallback, useEffect, useState } from 'react';
import { Link2, ShieldCheck, ShieldAlert, Flame, RotateCcw, Download, AlertTriangle, Info, Search } from 'lucide-react';
import { AuditEntry } from '../../../server/types.ts';
import { VerificationReport } from '../../../server/auditLog.ts';
import {
  AuditQueryParams,
  exportAudit,
  fetchAppConfig,
  fetchAuditAnchors,
  fetchAuditEntries,
  fetchAuditProof,
  resetSystemState,
  simulateAuditTamper,
} from '../../services/api.ts';

const DECISIONS = ['', 'allow', 'deny', 'approve', 'executed', 'blocked', 'pending', 'issued', 'redeemed', 'rejected', 'revoked', 'expired'];

/** Logs page: search, filters, pagination, per-entry verification (hash path + anchor), exports. */
export const AuditPage: React.FC = () => {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [verification, setVerification] = useState<VerificationReport | null>(null);
  const [filters, setFilters] = useState<AuditQueryParams>({});
  const [draft, setDraft] = useState<AuditQueryParams>({});
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(true);
  const [anchorCount, setAnchorCount] = useState(0);
  const [proof, setProof] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchAuditEntries({ ...filters, page, pageSize });
      setItems(r.items);
      setTotal(r.total);
      setVerification(r.verification);
      const a = await fetchAuditAnchors();
      setAnchorCount(a.anchors.length);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    fetchAppConfig().then((c) => setDemoMode(c.demoMode)).catch(() => undefined);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const applyFilters = () => {
    setPage(1);
    setFilters(draft);
  };
  const clearFilters = () => {
    setDraft({});
    setFilters({});
    setPage(1);
  };
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const set = (k: keyof AuditQueryParams) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  const verifyEntry = async (seq: number) => {
    try {
      setProof((await fetchAuditProof(seq)).proof);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Proof failed');
    }
  };

  const input = 'bg-[#090d18] border border-[#00e5ff]/20 rounded px-2 py-1 text-xs text-slate-200 font-mono';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold font-heading text-white uppercase tracking-wide flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#00e5ff]" />
            Logs · Keyed Audit Hash Chain
            <span className="text-3xs font-mono text-[#00f5a0] bg-[#00f5a0]/10 border border-[#00f5a0]/30 px-2 py-0.5 rounded">[KEYED HASH CHAIN + LOCAL ANCHORS]</span>
          </h2>
          <p className="text-xs text-[#8293aa] font-mono mt-0.5">
            <code>Hash_n = HMAC-SHA256(auditKey, Hash_{'{n-1}'} + canonical_entry)</code>. Every ledger event is committed here with its digest.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => exportAudit('jsonl', filters).catch((e) => setNotice(String(e)))} className="px-3 py-1.5 bg-[#090d18] border border-[#00e5ff]/20 text-slate-200 font-mono rounded text-xs flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export JSONL
          </button>
          <button type="button" onClick={() => exportAudit('csv', filters).catch((e) => setNotice(String(e)))} className="px-3 py-1.5 bg-[#090d18] border border-[#00e5ff]/20 text-slate-200 font-mono rounded text-xs flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          {demoMode && (
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                const r = await simulateAuditTamper(1).catch(() => null);
                setNotice(r ? `Demo: entry #${r.tamperedSeq} modified in memory. Verification below should now fail.` : 'Tamper demo unavailable');
                load();
              }}
              className="px-3 py-1.5 bg-[#ff365d]/10 border border-[#ff365d]/40 text-[#ff365d] font-mono rounded text-xs flex items-center gap-1.5"
            >
              <Flame className="w-3.5 h-3.5" /> Simulate Tampering
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              await resetSystemState().catch(() => undefined);
              setNotice('Demo reset: old files archived, new genesis entry written.');
              load();
            }}
            className="px-3 py-1.5 bg-[#090d18] border border-slate-600 text-slate-300 font-mono rounded text-xs flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>

      {/* Verification banner */}
      {verification && (
        <div className={`p-3 rounded border text-xs font-mono flex items-start gap-2 ${verification.valid ? 'bg-[#00f5a0]/10 border-[#00f5a0]/40 text-[#00f5a0]' : 'bg-[#ff365d]/10 border-[#ff365d]/50 text-[#ff365d]'}`}>
          {verification.valid ? <ShieldCheck className="w-4 h-4 shrink-0" /> : <ShieldAlert className="w-4 h-4 shrink-0" />}
          <div>
            {verification.valid
              ? `Chain verified: ${verification.totalEntries} entries, ${verification.anchor.anchorsChecked} anchor(s) checked (latest at seq ${verification.anchor.latestAnchorSeq ?? 'none'}).`
              : `INTEGRITY FAILURE: ${verification.reason ?? 'hash mismatch'}${verification.tamperedEntry ? ` (entry #${verification.tamperedEntry.seq})` : ''}`}
            <div className="text-3xs opacity-80 mt-0.5">{verification.integrityNote}</div>
            <div className="text-3xs opacity-80">{verification.anchorNote} Anchors written: {anchorCount}.</div>
          </div>
        </div>
      )}

      {notice && (
        <div className="p-3 bg-[#00e5ff]/10 border border-[#00e5ff]/30 text-[#00e5ff] font-mono rounded text-xs flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Filters */}
      <div className="p-3 bg-[#0b1329] border border-slate-800 rounded-lg grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 items-end">
        <label className="text-3xs text-slate-400 col-span-2">
          Search
          <div className="flex items-center gap-1">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <input className={`${input} w-full`} placeholder="text in entry" value={draft.search ?? ''} onChange={set('search')} onKeyDown={(e) => e.key === 'Enter' && applyFilters()} />
          </div>
        </label>
        <label className="text-3xs text-slate-400">
          sessionId
          <input className={`${input} w-full`} value={draft.sessionId ?? ''} onChange={set('sessionId')} />
        </label>
        <label className="text-3xs text-slate-400">
          ruleId
          <input className={`${input} w-full`} placeholder="R3_DOMAIN_ALLOWLIST" value={draft.ruleId ?? ''} onChange={set('ruleId')} />
        </label>
        <label className="text-3xs text-slate-400">
          tool
          <input className={`${input} w-full`} placeholder="send_email" value={draft.tool ?? ''} onChange={set('tool')} />
        </label>
        <label className="text-3xs text-slate-400">
          decision
          <select className={`${input} w-full`} value={draft.decision ?? ''} onChange={set('decision')}>
            {DECISIONS.map((d) => (
              <option key={d} value={d}>
                {d || 'any'}
              </option>
            ))}
          </select>
        </label>
        <label className="text-3xs text-slate-400">
          from (date)
          <input type="datetime-local" className={`${input} w-full`} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value ? new Date(e.target.value).toISOString() : '' }))} />
        </label>
        <label className="text-3xs text-slate-400">
          to (date)
          <input type="datetime-local" className={`${input} w-full`} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value ? new Date(e.target.value).toISOString() : '' }))} />
        </label>
        <div className="flex gap-2 col-span-2">
          <button type="button" onClick={applyFilters} className="px-3 py-1.5 bg-[#00e5ff] text-[#080b12] font-bold rounded text-xs">Apply</button>
          <button type="button" onClick={clearFilters} className="px-3 py-1.5 bg-slate-800 text-slate-200 rounded text-xs">Clear</button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-lg overflow-x-auto">
        <table className="w-full text-3xs font-mono text-slate-300">
          <thead className="text-slate-500 text-left">
            <tr>
              <th className="p-2">#</th>
              <th className="p-2">time</th>
              <th className="p-2">type</th>
              <th className="p-2">session</th>
              <th className="p-2">rule</th>
              <th className="p-2">tool</th>
              <th className="p-2">decision</th>
              <th className="p-2">hash</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((e) => {
              const d = e.data as Record<string, any>;
              const tampered = Boolean(d._tampered);
              return (
                <tr key={e.seq} className={`border-t border-slate-800 ${tampered ? 'bg-[#ff365d]/10' : ''}`}>
                  <td className="p-2">{e.seq}</td>
                  <td className="p-2 whitespace-nowrap">{e.ts.replace('T', ' ').slice(0, 19)}</td>
                  <td className="p-2">{e.type}{tampered ? ' · TAMPERED' : ''}</td>
                  <td className="p-2 max-w-[160px] truncate" title={e.sessionId}>{e.sessionId}</td>
                  <td className="p-2">{d.ruleId ?? ''}</td>
                  <td className="p-2">{d.tool ?? ''}</td>
                  <td className="p-2">{d.action ?? d.decision ?? ''}</td>
                  <td className="p-2" title={e.hash}>{e.hash.slice(0, 12)}…</td>
                  <td className="p-2">
                    <button type="button" onClick={() => verifyEntry(e.seq)} className="px-2 py-0.5 border border-[#00e5ff]/40 text-[#00e5ff] rounded">
                      Verify this entry
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td className="p-4 text-slate-500" colSpan={9}>
                  {loading ? 'Loading…' : 'No entries match.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs font-mono text-slate-400">
        <span>
          {total} entries · Page {page} of {pages}
        </span>
        <div className="flex items-center gap-2">
          <select className={input} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-2 py-1 border border-slate-700 rounded disabled:opacity-40">Prev</button>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="px-2 py-1 border border-slate-700 rounded disabled:opacity-40">Next</button>
        </div>
      </div>

      {/* Proof panel */}
      {proof && (
        <div className="p-4 bg-[#0b1329] border border-[#00e5ff]/30 rounded-lg text-xs font-mono text-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-bold text-white">Proof for entry #{proof.entry.seq}</div>
            <button type="button" className="text-slate-400" onClick={() => setProof(null)}>close</button>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className={proof.entryHashValid ? 'text-[#00f5a0]' : 'text-[#ff365d]'}>{proof.entryHashValid ? '✓' : '✗'} keyed hash recomputed</span>
            <span className={proof.linkValid ? 'text-[#00f5a0]' : 'text-[#ff365d]'}>{proof.linkValid ? '✓' : '✗'} links to previous entry</span>
            <span className={proof.pathValid ? 'text-[#00f5a0]' : 'text-[#ffb020]'}>{proof.pathValid ? '✓' : '–'} hash path to anchor</span>
            <span className={proof.anchorSigValid && proof.anchorMatches ? 'text-[#00f5a0]' : 'text-[#ffb020]'}>
              {proof.anchor ? `${proof.anchorSigValid && proof.anchorMatches ? '✓' : '✗'} anchor @ seq ${proof.anchor.seq}` : '– no anchor covers this entry yet'}
            </span>
          </div>
          <div className="text-3xs text-slate-400">{proof.note}</div>
          {proof.path.length > 0 && (
            <div className="max-h-40 overflow-y-auto border border-slate-800 rounded p-2 text-3xs">
              {proof.path.map((p: any) => (
                <div key={p.seq}>
                  #{p.seq} prev {p.prevHash.slice(0, 10)}… → hash {p.hash.slice(0, 10)}…
                </div>
              ))}
              {proof.anchor && <div className="text-[#00e5ff]">anchor head {proof.anchor.headHash.slice(0, 10)}… signed {proof.anchor.ts}</div>}
            </div>
          )}
          <pre className="text-3xs text-slate-400 overflow-x-auto max-h-40">{JSON.stringify(proof.entry.data, null, 2)}</pre>
        </div>
      )}

      <div className="p-3 bg-[#a855f7]/10 border border-[#a855f7]/30 text-[#e6edf6] rounded text-xs flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-[#a855f7] mt-0.5 shrink-0" />
        <div className="leading-relaxed">
          <strong className="text-white">Integrity claims &amp; limits: </strong>
          Hash-chained and keyed; detects edits, deletions and reordering; an attacker with both the key and the files can still forge; external anchoring is the production fix. Signed checkpoints in a separate anchors file detect tail truncation: local witness simulation; production would use an external transparency log or RFC 3161 timestamping.
        </div>
      </div>
    </div>
  );
};
