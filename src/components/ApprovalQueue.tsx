import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle2, XCircle, AlertTriangle, ShieldAlert } from 'lucide-react';
import { ApprovalItem } from '../../server/types.ts';
import { fetchApprovals, resolveApproval } from '../services/api.ts';

interface ApprovalQueueProps {
  onApprovalResolved?: () => void;
}

export const ApprovalQueue: React.FC<ApprovalQueueProps> = ({ onApprovalResolved }) => {
  const [approvals, setApprovals] = useState<{ pending: ApprovalItem[]; all: ApprovalItem[] }>({
    pending: [],
    all: [],
  });
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // Polling / countdown clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadApprovals = async () => {
    try {
      const data = await fetchApprovals();
      setApprovals(data);
    } catch (err) {
      console.error('Failed to load approvals:', err);
    }
  };

  useEffect(() => {
    loadApprovals();
    const interval = setInterval(loadApprovals, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleDecision = async (id: string, action: 'APPROVE' | 'DENY') => {
    setActionLoadingId(id);
    try {
      await resolveApproval(id, action);
      await loadApprovals();
      if (onApprovalResolved) onApprovalResolved();
    } catch (err) {
      console.error(`Failed to ${action} item:`, err);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              Action Gate Human Approval Queue
              <span className="text-2xs font-mono text-slate-500 font-normal">
                [BUILT: 60-Second Auto-Expiry]
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sensitive tools invoked in untrusted contexts (R1) or financial operations exceeding thresholds (R4) require human sign-off before credential minting.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Pending Review:</span>
            <span className="font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              {approvals.pending.length}
            </span>
          </div>
        </div>

        {approvals.pending.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No pending tool invocations awaiting approval. Trigger Scenario S1 or S2 in ENFORCE mode to test the approval flow.
          </div>
        ) : (
          <div className="space-y-4">
            {approvals.pending.map((item) => {
              const secondsLeft = Math.max(0, Math.round((item.expiresAt - now) / 1000));
              const isUrgent = secondsLeft < 20;

              return (
                <div
                  key={item.id}
                  className="p-4 border border-amber-300 bg-amber-50/50 rounded-lg shadow-2xs"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        Tool: <code className="font-mono text-indigo-700">{item.toolCall.tool}</code>
                      </span>
                      <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-semibold">
                        Risk: {item.riskLevel}
                      </span>
                      <span className="text-2xs font-mono text-slate-500">
                        Rule: {item.ruleId}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div
                        className={`flex items-center gap-1 text-xs font-mono font-bold px-2 py-1 rounded ${
                          isUrgent ? 'bg-rose-100 text-rose-800 animate-pulse' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Auto-Deny in: {secondsLeft}s</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 mb-3 font-medium">
                    {item.reason}
                  </p>

                  <div className="bg-white p-3 rounded border border-slate-200 mb-3">
                    <div className="text-2xs font-semibold text-slate-600 uppercase mb-1">
                      Proposed Arguments Bound to Scope:
                    </div>
                    <pre className="text-2xs font-mono text-slate-800 whitespace-pre-wrap">
                      {JSON.stringify(item.toolCall.args, null, 2)}
                    </pre>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={actionLoadingId === item.id || secondsLeft === 0}
                      onClick={() => handleDecision(item.id, 'DENY')}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Deny &amp; Reject Token
                    </button>
                    <button
                      type="button"
                      disabled={actionLoadingId === item.id || secondsLeft === 0}
                      onClick={() => handleDecision(item.id, 'APPROVE')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve &amp; Mint 60s Token
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* History Table */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3">
          Approval Decision Log (Historical)
        </h4>
        {approvals.all.length === 0 ? (
          <div className="text-center py-4 text-xs text-slate-500">
            No historical approval decisions recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2 px-3">Timestamp</th>
                  <th className="py-2 px-3">Session</th>
                  <th className="py-2 px-3">Tool</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {approvals.all.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 text-slate-600">
                      {new Date(item.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3 text-slate-500">{item.sessionId.substring(0, 14)}...</td>
                    <td className="py-2 px-3 font-semibold text-slate-800">{item.toolCall.tool}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-2xs font-bold ${
                          item.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'DENIED'
                            ? 'bg-rose-100 text-rose-800'
                            : item.status === 'EXPIRED'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600 font-sans">{item.decisionNotes || item.reason}</td>
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
