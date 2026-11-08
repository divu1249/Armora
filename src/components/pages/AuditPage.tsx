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
import { fetchAuditLog, verifyAuditChain, simulateAuditTamper, resetSystemState } from '../../services/api.ts';

export const AuditPage: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Link2 className="w-4 h-4 text-cyan-400" />
              Cryptographic Audit Hash Chain
              <span className="text-2xs font-mono text-cyan-300 bg-cyan-950 border border-cyan-850 px-2 py-0.5 rounded">
                [SHA-256 Append-Only]
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tamper-evident ledger linking decisions: <code>Hash_n = SHA-256(Hash_{'{n-1}'} + canonical_JSON)</code>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={handleVerify}
              className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg text-xs shadow-sm transition-colors flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-slate-950" />
              <span>Verify Chain</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleTamper}
              className="px-3.5 py-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5"
            >
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>Simulate Tampering</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleExportJson}
              className="px-3.5 py-1.5 bg-[#0b1329] hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-white" />
              <span>Export JSON</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleReset}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Roadmap Disclaimer Notice */}
        <div className="p-3 bg-purple-950/40 border border-purple-800/60 text-purple-200 rounded-lg text-xs flex items-start gap-2.5 mb-4">
          <Info className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
          <div className="leading-relaxed">
            <strong className="text-white">Tamper Evidence &amp; Tail Truncation Note: </strong>
            Internal verification mathematically proves sequential continuity and detects any retroactive block modification.
            <span className="text-purple-300 ml-1">
              Note: Tail truncation (dropping trailing blocks) is not detectable without an external witness anchor or public transparency log <span className="font-mono text-2xs font-semibold">[ROADMAP]</span>.
            </span>
          </div>
        </div>

        {notice && (
          <div className="p-3 bg-blue-950/60 border border-blue-800 text-blue-200 rounded-lg text-xs flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* Verification Report Banner */}
        {report && (
          <div
            className={`p-4 rounded-xl border text-xs mb-4 ${
              report.valid
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                : 'bg-rose-950/50 border-rose-800 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2 font-bold uppercase text-xs">
              {report.valid ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Chain Verified: 100% Cryptographic Continuity ({report.totalEntries} Blocks)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>TAMPER DETECTED: Hash Mismatch Pinpointed at Block #{report.tamperedEntry?.seq}</span>
                </>
              )}
            </div>

            {!report.valid && report.tamperedEntry && (
              <div className="mt-2 text-2xs font-mono bg-[#0b1329] p-3 rounded-lg border border-rose-800/80 text-slate-200 space-y-1">
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
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm space-y-3 font-mono">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between font-sans">
          <span>Sequential Cryptographic Blocks ({entries.length} Total)</span>
          <span className="text-2xs font-mono text-slate-500 font-normal">Genesis: 00000000...</span>
        </h4>

        <div className="space-y-3 text-xs">
          {entries.map((entry) => {
            const isTampered = Boolean(entry.data?._tampered);
            return (
              <div
                key={entry.seq}
                className={`p-3.5 rounded-lg border transition-colors ${
                  isTampered
                    ? 'bg-rose-950/40 border-rose-600 ring-1 ring-rose-500'
                    : 'bg-[#0b1329] border-slate-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-cyan-300 bg-cyan-950 border border-cyan-800 px-2 py-0.5 rounded text-2xs">
                      Block #{entry.seq}
                    </span>
                    <span className="font-sans font-semibold text-white">{entry.type}</span>
                    {isTampered && (
                      <span className="text-2xs font-bold bg-rose-600 text-white px-2 py-0.5 rounded">
                        TAMPERED DATA
                      </span>
                    )}
                  </div>
                  <div className="text-2xs text-slate-500">
                    {entry.ts} · Session: {entry.sessionId.substring(0, 16)}...
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-2xs mb-2">
                  <div>
                    <span className="text-slate-500">prevHash: </span>
                    <span className="text-slate-400">{entry.prevHash.substring(0, 28)}...</span>
                  </div>
                  <div>
                    <span className="text-slate-500">hash: </span>
                    <span className="text-cyan-300 font-semibold">{entry.hash.substring(0, 28)}...</span>
                  </div>
                </div>

                <div className="bg-[#0f172a] p-2.5 rounded border border-slate-800/80 text-2xs text-slate-300 whitespace-pre-wrap max-h-24 overflow-y-auto">
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
