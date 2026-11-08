import React, { useEffect, useState } from 'react';
import {
  Link2,
  ShieldCheck,
  ShieldAlert,
  Flame,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { AuditEntry } from '../../server/types.ts';
import { VerificationReport } from '../../server/auditLog.ts';
import { fetchAuditLog, verifyAuditChain, simulateAuditTamper, resetSystemState } from '../services/api.ts';

export const AuditLogViewer: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadLog = async () => {
    try {
      const data = await fetchAuditLog();
      setEntries(data.entries);
    } catch (err) {
      console.error('Failed to load audit log:', err);
    }
  };

  useEffect(() => {
    loadLog();
  }, []);

  const handleVerify = async () => {
    setLoading(true);
    setActionNotice(null);
    try {
      const rep = await verifyAuditChain();
      setReport(rep);
    } catch (err) {
      console.error('Failed to verify chain:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTamper = async () => {
    setLoading(true);
    try {
      const res = await simulateAuditTamper(1);
      setActionNotice(`Malicious mutation injected into Block #${res.tamperedSeq}. Now click "Verify Chain Integrity" to test cryptographic tamper detection.`);
      await loadLog();
      await handleVerify();
    } catch (err) {
      console.error('Failed to tamper:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await resetSystemState();
      setActionNotice('Audit hash chain and system state reset to Genesis block.');
      setReport(null);
      await loadLog();
    } catch (err) {
      console.error('Failed to reset:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview & Action Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-indigo-600" />
              Cryptographic Audit Hash Chain
              <span className="text-2xs font-mono text-slate-500 font-normal">
                [BUILT: Append-Only SHA-256 Ledger]
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Every Action Gate decision and token issuance is recorded with SHA-256 linking: <code>Hash_n = SHA-256(Hash_{'{n-1}'} + canonical_JSON)</code>. PII is masked with HMAC-SHA256 secrets.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={handleVerify}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Verify Chain Integrity
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleTamper}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Flame className="w-3.5 h-3.5" />
              Simulate Tamper
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleReset}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Chain
            </button>
          </div>
        </div>

        {/* Roadmap Disclaimer Notice */}
        <div className="p-3 bg-purple-50 border border-purple-200 text-purple-900 rounded-md text-xs flex items-start gap-2">
          <Info className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
          <div>
            <strong className="font-semibold">Cryptographic Guarantee &amp; Roadmap Anchor: </strong>
            Hash chain verification proves sequential continuity and detects any retroactive modification of past entries.
            <span className="text-purple-700 ml-1">
              Note: Tail truncation (dropping trailing recent blocks) is not detectable without an external witness anchor or public transparency log <span className="font-mono text-2xs font-semibold">[ROADMAP]</span>.
            </span>
          </div>
        </div>

        {/* Action notices */}
        {actionNotice && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-md text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-blue-600" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Verification Report Card */}
        {report && (
          <div
            className={`mt-4 p-4 rounded-lg border ${
              report.valid
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs uppercase mb-1">
              {report.valid ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Chain Integrity Verified: 100% Cryptographic Continuity ({report.totalEntries} Blocks Valid)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>TAMPER DETECTED: Hash Mismatch at Block #{report.tamperedEntry?.seq}</span>
                </>
              )}
            </div>

            {!report.valid && report.tamperedEntry && (
              <div className="mt-2 text-2xs font-mono bg-white p-3 rounded border border-rose-200 text-slate-800 space-y-1">
                <div>Broken Block Sequence: #{report.tamperedEntry.seq}</div>
                <div>Expected Hash: {report.tamperedEntry.expectedHash}</div>
                <div>Actual Hash:   {report.tamperedEntry.actualHash}</div>
                <div>Previous Hash: {report.tamperedEntry.prevHash}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chain Table / Visualizer */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3 flex items-center justify-between">
          <span>Sequential Blocks ({entries.length} Total)</span>
          <span className="text-2xs font-mono text-slate-500 font-normal">
            Genesis Hash: 00000000...
          </span>
        </h4>

        <div className="space-y-3 font-mono">
          {entries.map((entry) => {
            const isTampered = Boolean(entry.data?._tampered);
            return (
              <div
                key={entry.seq}
                className={`p-3 rounded-lg border text-xs transition-colors ${
                  isTampered
                    ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded text-2xs">
                      #{entry.seq}
                    </span>
                    <span className="font-semibold text-slate-800 font-sans">
                      {entry.type}
                    </span>
                    {isTampered && (
                      <span className="text-2xs bg-rose-200 text-rose-900 px-1.5 py-0.2 rounded font-bold">
                        TAMPERED DATA
                      </span>
                    )}
                  </div>
                  <div className="text-2xs text-slate-500">
                    {entry.ts} · Session: {entry.sessionId.substring(0, 14)}...
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-2xs text-slate-600 mb-2">
                  <div>
                    <span className="text-slate-400">prevHash: </span>
                    <span className="text-slate-700">{entry.prevHash.substring(0, 24)}...</span>
                  </div>
                  <div>
                    <span className="text-slate-400">hash: </span>
                    <span className="text-indigo-900 font-semibold">{entry.hash.substring(0, 24)}...</span>
                  </div>
                </div>

                <div className="bg-white p-2 rounded border border-slate-200 text-2xs text-slate-800 whitespace-pre-wrap max-h-24 overflow-y-auto">
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
