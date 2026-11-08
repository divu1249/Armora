import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, ShieldAlert, Send } from 'lucide-react';
import { ApprovalItem } from '../../../server/types.ts';
import { fetchApprovals, resolveApproval } from '../../services/api.ts';

interface ApprovalsPageProps {
  onApprovalResolved?: () => void;
}

export const ApprovalsPage: React.FC<ApprovalsPageProps> = ({ onApprovalResolved }) => {
  const [approvals, setApprovals] = useState<{ pending: ApprovalItem[]; all: ApprovalItem[] }>({
    pending: [],
    all: [],
  });
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [reasonInputs, setReasonInputs] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    try {
      const data = await fetchApprovals();
      setApprovals(data);
    } catch (err) {
      console.error('Failed to load approvals:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleDecision = async (id: string, action: 'APPROVE' | 'DENY') => {
    setActionLoadingId(id);
    setNotice(null);
    const reasonText = reasonInputs[id]?.trim() || (action === 'APPROVE' ? 'Approved by security reviewer' : 'Denied by security reviewer');

    try {
      await resolveApproval(id, action, reasonText);
      setNotice(`Decision "${action}" recorded in Cryptographic Audit Log for item ${id}.`);
      await loadData();
      if (onApprovalResolved) onApprovalResolved();
      setTimeout(() => setNotice(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice(`Error: ${msg}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Action Gate Human Approval Queue
              <span className="text-2xs font-mono text-amber-300 bg-amber-950 border border-amber-850 px-2 py-0.5 rounded">
                [60s Auto-Expiration]
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              High-risk actions, unverified UPI handles, or external communications from untrusted sessions require explicit human authorization before single-use token issuance.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Pending Review:</span>
            <span className="font-mono font-bold text-amber-400 bg-amber-950 border border-amber-800 px-2.5 py-0.5 rounded">
              {approvals.pending.length}
            </span>
          </div>
        </div>

        {notice && (
          <div className="p-3 bg-cyan-950/60 border border-cyan-800 text-cyan-200 rounded-lg text-xs flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {approvals.pending.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs bg-[#0b1329] border border-slate-800/80 rounded-xl space-y-2">
            <ShieldCheck className="w-8 h-8 text-cyan-400 mx-auto" />
            <h4 className="text-sm font-semibold text-white">No Pending Approvals</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              All in-flight tool calls have been evaluated. Trigger Scenario S1 or S2 in ENFORCE mode from the Scenario Runner to test the approval flow.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {approvals.pending.map((item) => {
              const secondsLeft = Math.max(0, Math.round((item.expiresAt - now) / 1000));
              const isUrgent = secondsLeft < 20;

              return (
                <div
                  key={item.id}
                  className="p-5 border border-amber-800/70 bg-[#0d1629] rounded-xl shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-white">Tool:</span>
                      <code className="font-mono text-cyan-300 font-bold bg-cyan-950/80 border border-cyan-800 px-2 py-0.5 rounded">
                        {item.toolCall.tool}()
                      </code>
                      <span className="font-mono text-2xs px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                        Risk: {item.riskLevel}
                      </span>
                      <span className="text-2xs font-mono text-slate-400">Rule: {item.ruleId}</span>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1 rounded-md border ${
                        isUrgent
                          ? 'bg-rose-950 border-rose-700 text-rose-300 animate-pulse'
                          : 'bg-amber-950 border-amber-700 text-amber-300'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Expires in {secondsLeft}s (Auto-Deny)</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-200 font-medium leading-relaxed">
                    {item.reason}
                  </p>

                  <div className="bg-[#0b1329] p-3 rounded-lg border border-slate-800 text-2xs font-mono space-y-1">
                    <div className="text-slate-400 font-bold uppercase">Proposed Arguments to be Cryptographically Bound:</div>
                    <pre className="text-slate-200 whitespace-pre-wrap max-h-28 overflow-y-auto">
                      {JSON.stringify(item.toolCall.args, null, 2)}
                    </pre>
                  </div>

                  {/* Reason input field */}
                  <div>
                    <label className="block text-2xs font-semibold text-slate-400 mb-1 uppercase">
                      Security Reviewer Reason / Audit Note:
                    </label>
                    <input
                      type="text"
                      placeholder="Optional audit reason note for this approval decision..."
                      value={reasonInputs[item.id] || ''}
                      onChange={(e) =>
                        setReasonInputs((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      className="w-full bg-[#0b1329] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      disabled={actionLoadingId === item.id || secondsLeft === 0}
                      onClick={() => handleDecision(item.id, 'DENY')}
                      className="px-4 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-700 text-rose-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span>Deny &amp; Reject Token</span>
                    </button>
                    <button
                      type="button"
                      disabled={actionLoadingId === item.id || secondsLeft === 0}
                      onClick={() => handleDecision(item.id, 'APPROVE')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span>Approve &amp; Mint 60s Token</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historical Approvals Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
          Historical Approval Decisions (Audit Ledger Logged)
        </h4>

        {approvals.all.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">
            No historical approval decisions recorded.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#0b1329] border-b border-slate-800 text-slate-400 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Session</th>
                  <th className="py-2.5 px-3">Tool</th>
                  <th className="py-2.5 px-3">Decision</th>
                  <th className="py-2.5 px-3">Reason / Audit Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {approvals.all.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400">
                      {new Date(item.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 text-cyan-400">{item.sessionId.substring(0, 14)}...</td>
                    <td className="py-2.5 px-3 font-semibold text-white">{item.toolCall.tool}()</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-2xs font-bold px-2 py-0.5 rounded ${
                          item.status === 'APPROVED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : item.status === 'DENIED'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : item.status === 'EXPIRED'
                            ? 'bg-slate-800 text-slate-400 border border-slate-700'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-sans">{item.decisionNotes || item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
