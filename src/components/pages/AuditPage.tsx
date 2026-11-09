import React, { useEffect, useState } from 'react';
import {
  Link2,
  ShieldCheck,
  ShieldAlert,
  Flame,
  RotateCcw,
  Download,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { AuditEntry } from '../../../server/types.ts';
import { VerificationReport } from '../../../server/auditLog.ts';
import { fetchAuditLog, verifyAuditChain, simulateAuditTamper, resetSystemState, fetchAppConfig, fetchAuditAnchors } from '../../services/api.ts';

export const AuditPage: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState<boolean>(true);
  const [anchors, setAnchors] = useState<Array<{ seq: number; headHash: string; ts: string }>>([]);

  useEffect(() => {
    fetchAppConfig().then((c) => setDemoMode(c.demoMode)).catch(() => undefined);
    fetchAuditAnchors().then((a) => setAnchors(a.anchors)).catch(() => undefined);
  }, []);

  const loadData = async () => {
    try {
      const data = await fetchAuditLog();
      setEntries(data.entries);
    } catch (err) {
      console.error('Failed to load audit log:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleVerify = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const rep = await verifyAuditChain();
      setReport(rep);
    } catch (err) {
      console.error('Verification failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTamper = async () => {
    setLoading(true);
    try {
      const res = await simulateAuditTamper(1);
      setNotice(`Malicious data injected into Block #${res.tamperedSeq}. Now click "Verify Chain" to observe cryptographic failure detection.`);
      await loadData();
      await handleVerify();
    } catch (err) {
      console.error('Tampering failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await resetSystemState();
      setNotice('Audit hash chain reset to genesis block.');
      setReport(null);
      await loadData();
    } catch (err) {
      console.error('Reset failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(entries, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `llm_firewall_audit_chain_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="cyber-card cyber-corner-tr rounded p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#00e5ff]/15 pb-4 mb-2">
          <div>
            <h2 className="text-sm font-bold font-heading text-white uppercase tracking-wide flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#00e5ff]" />
              Cryptographic Audit Hash Chain
              <span className="text-3xs font-mono text-[#00f5a0] bg-[#00f5a0]/10 border border-[#00f5a0]/30 px-2 py-0.5 rounded">
                [KEYED HASH CHAIN + LOCAL ANCHORS]
              </span>
            </h2>
            <p className="text-xs text-[#8293aa] font-mono mt-0.5">
              Tamper-evident ledger: <code>Hash_n = HMAC-SHA256(auditKey, Hash_{'{n-1}'} + canonical_entry)</code>, persisted to JSONL and re-verified on boot.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={handleVerify}
              className="px-3.5 py-1.5 bg-gradient-to-r from-[#00e5ff] to-[#00a8ff] hover:from-[#33ecff] hover:to-[#33b8ff] text-[#080b12] font-black font-mono rounded text-xs shadow-[0_0_12px_rgba(0,229,255,0.4)] transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#080b12]" />
              <span>Verify Chain</span>
            </button>
            {demoMode && (
            <button
              type="button"
              disabled={loading}
              onClick={handleTamper}
              className="px-3.5 py-1.5 bg-[#ff365d]/10 hover:bg-[#ff365d]/20 border border-[#ff365d]/40 text-[#ff365d] font-mono font-semibold rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 text-[#ff365d]" />
              <span>Simulate Tampering</span>
            </button>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={handleExportJson}
              className="px-3.5 py-1.5 bg-[#090d18] hover:bg-[#141f33] border border-[#00e5ff]/20 text-slate-200 font-mono font-semibold rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#00e5ff]" />
              <span>Export JSON</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleReset}
              className="px-3 py-1.5 bg-[#090d18] hover:bg-[#141f33] text-[#8293aa] hover:text-white border border-[#00e5ff]/15 rounded text-xs font-mono transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Roadmap Disclaimer Notice */}
        <div className="p-3 bg-[#a855f7]/10 border border-[#a855f7]/30 text-[#e6edf6] rounded text-xs font-sans flex items-start gap-2.5 mb-4">
          <Info className="w-4 h-4 text-[#a855f7] mt-0.5 shrink-0" />
          <div className="leading-relaxed">
            <strong className="text-white">Integrity claims &amp; limits: </strong>
            Hash-chained and keyed; detects edits, deletions and reordering; an attacker with both the key and the files can still forge; external anchoring is the production fix.
            <span className="text-[#c084fc] ml-1">
              Signed checkpoints in a separate anchors file detect tail truncation: local witness simulation; production would use an external transparency log or RFC 3161 timestamping.
            </span>
          </div>
        </div>

        <div className="text-2xs font-mono text-[#8293aa] mb-3">
          Anchors written: {anchors.length}
          {anchors.length > 0 && ` (latest at seq ${anchors[anchors.length - 1].seq}, head ${anchors[anchors.length - 1].headHash.slice(0, 12)}...)`} · local witness simulation
        </div>

        {notice && (
          <div className="p-3 bg-[#00e5ff]/10 border border-[#00e5ff]/30 text-[#00e5ff] font-mono rounded text-xs flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-[#00e5ff] shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* Verification Report Banner */}
        {report && (
          <div
            className={`p-4 rounded border text-xs font-mono mb-4 ${
              report.valid
                ? 'bg-[#00f5a0]/10 border-[#00f5a0]/40 text-[#00f5a0]'
                : 'bg-[#ff365d]/10 border-[#ff365d]/40 text-[#ff365d]'
            }`}
          >
            <div className="flex items-center gap-2 font-bold uppercase text-xs">
              {report.valid ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#00f5a0]" />
                  <span>Chain Verified: 100% Cryptographic Continuity ({report.totalEntries} Blocks)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-[#ff365d]" />
                  <span>INTEGRITY FAILURE: {report.reason ?? 'hash mismatch'}{report.tamperedEntry ? ` (block #${report.tamperedEntry.seq})` : ''}</span>
                </>
              )}
            </div>

            {!report.valid && report.tamperedEntry && (
              <div className="mt-2 text-2xs font-mono bg-[#050810] p-3 rounded border border-[#ff365d]/40 text-slate-200 space-y-1">
                <div>Broken Block Sequence: #{report.tamperedEntry.seq}</div>
                <div>Expected Hash: {report.tamperedEntry.expectedHash}</div>
                <div>Actual Hash:   {report.tamperedEntry.actualHash}</div>
                <div>Previous Hash: {report.tamperedEntry.prevHash}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sequential Chain Table */}
      <div className="cyber-card rounded p-5 space-y-3 font-mono">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between font-heading">
          <span>Sequential Cryptographic Blocks ({entries.length} Total)</span>
          <span className="text-3xs font-mono text-[#8293aa] font-normal">Genesis: 00000000...</span>
        </h4>

        <div className="space-y-3 text-xs">
          {entries.map((entry) => {
            const isTampered = Boolean(entry.data?._tampered);
            return (
              <div
                key={entry.seq}
                className={`p-3.5 rounded border transition-colors ${
                  isTampered
                    ? 'bg-[#150a10] border-[#ff365d] ring-1 ring-[#ff365d]'
                    : 'bg-[#090d18] border-[#00e5ff]/15'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#00e5ff]/10 pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#00e5ff] bg-[#00e5ff]/10 border border-[#00e5ff]/30 px-2 py-0.5 rounded text-2xs">
                      Block #{entry.seq}
                    </span>
                    <span className="font-heading font-semibold text-white">{entry.type}</span>
                    {isTampered && (
                      <span className="text-3xs font-black bg-[#ff365d] text-white px-2 py-0.5 rounded">
                        TAMPERED DATA
                      </span>
                    )}
                  </div>
                  <div className="text-3xs text-[#8293aa]">
                    {entry.ts} · Session: {entry.sessionId.substring(0, 16)}...
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-2xs mb-2">
                  <div>
                    <span className="text-[#8293aa]">prevHash: </span>
                    <span className="text-slate-400">{entry.prevHash.substring(0, 28)}...</span>
                  </div>
                  <div>
                    <span className="text-[#8293aa]">hash: </span>
                    <span className="text-[#00e5ff] font-semibold">{entry.hash.substring(0, 28)}...</span>
                  </div>
                </div>

                <div className="bg-[#050810] p-2.5 rounded border border-[#00e5ff]/10 text-2xs text-slate-300 whitespace-pre-wrap max-h-24 overflow-y-auto scanlines-overlay">
                  {JSON.stringify(entry.data, null, 2)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
