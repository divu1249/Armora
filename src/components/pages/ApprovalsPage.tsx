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
      <div className="bg-surface border border-line rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-fg flex items-center gap-2">
              <Clock className="w-4 h-4 text-warn" />
              Action Gate Human Approval Queue
              <span className="text-2xs font-mono text-warn bg-warn-solid border border-warn-solid/40 px-2 py-0.5 rounded">
                [60s Auto-Expiration]
              </span>
            </h2>
            <p className="text-xs text-muted mt-0.5">
              High-risk actions, unverified UPI handles, or external communications from untrusted sessions require explicit human authorization before single-use token issuance.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted">Pending Review:</span>
            <span className="font-mono font-bold text-warn bg-warn-solid border border-warn-solid/40 px-2.5 py-0.5 rounded">
              {approvals.pending.length}
            </span>
          </div>
        </div>

        {notice && (
          <div className="p-3 bg-accent-solid/10 border border-accent-solid/40 text-accent rounded-lg text-xs flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {approvals.pending.length === 0 ? (
          <div className="p-10 text-center text-muted text-xs bg-subtle border border-line rounded-xl space-y-2">
            <ShieldCheck className="w-8 h-8 text-accent mx-auto" />
            <h4 className="text-sm font-semibold text-fg">No Pending Approvals</h4>
            <p className="text-xs text-muted max-w-md mx-auto">
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
                  className="p-5 border border-warn-solid/40 bg-subtle rounded-xl shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-fg">Tool:</span>
                      <code className="font-mono text-accent font-bold bg-accent-solid/10 border border-accent-solid/40 px-2 py-0.5 rounded">
                        {item.toolCall.tool}()
                      </code>
                      <span className="font-mono text-2xs px-2 py-0.5 rounded bg-warn-solid text-warn border border-warn-solid/40">
                        Risk: {item.riskLevel}
                      </span>
                      <span className="text-2xs font-mono text-muted">Rule: {item.ruleId}</span>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1 rounded-md border ${
                        isUrgent
                          ? 'bg-danger-solid border-danger-solid/40 text-danger '
                          : 'bg-warn-solid border-warn-solid/40 text-warn'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Expires in {secondsLeft}s (Auto-Deny)</span>
                    </div>
                  </div>

                  <p className="text-xs text-fg font-medium leading-relaxed">
                    {item.reason}
                  </p>

                  <div className="bg-subtle p-3 rounded-lg border border-line text-2xs font-mono space-y-1">
                    <div className="text-muted font-bold uppercase">Proposed Arguments to be Cryptographically Bound:</div>
                    <pre className="text-fg whitespace-pre-wrap max-h-28 overflow-y-auto">
                      {JSON.stringify(item.toolCall.args, null, 2)}
                    </pre>
                  </div>

                  {/* Reason input field */}
                  <div>
                    <label className="block text-2xs font-semibold text-muted mb-1 uppercase">
                      Security Reviewer Reason / Audit Note:
                    </label>
                    <input
                      type="text"
                      placeholder="Optional audit reason note for this approval decision..."
                      value={reasonInputs[item.id] || ''}
                      onChange={(e) =>
                        setReasonInputs((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      className="w-full bg-subtle border border-line rounded-lg px-3 py-1.5 text-xs text-fg placeholder:text-muted focus:outline-none focus:border-accent-solid/40"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      disabled={actionLoadingId === item.id || secondsLeft === 0}
                      onClick={() => handleDecision(item.id, 'DENY')}
                      className="px-4 py-2 bg-danger-solid hover:brightness-110 border border-danger-solid/40 text-danger rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4 text-danger" />
                      <span>Deny &amp; Reject Token</span>
                    </button>
                    <button
                      type="button"
                      disabled={actionLoadingId === item.id || secondsLeft === 0}
                      onClick={() => handleDecision(item.id, 'APPROVE')}
                      className="px-4 py-2 bg-ok-solid hover:bg-ok-solid/10 text-on-solid rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4 text-fg" />
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
      <div className="bg-surface border border-line rounded-xl p-5 shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-fg uppercase tracking-wider">
          Historical Approval Decisions (Audit Ledger Logged)
        </h4>

        {approvals.all.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted">
            No historical approval decisions recorded.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-subtle border-b border-line text-muted font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Session</th>
                  <th className="py-2.5 px-3">Tool</th>
                  <th className="py-2.5 px-3">Decision</th>
                  <th className="py-2.5 px-3">Reason / Audit Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-mono">
                {approvals.all.map((item) => (
                  <tr key={item.id} className="hover:bg-subtle transition-colors">
                    <td className="py-2.5 px-3 text-muted">
                      {new Date(item.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 text-accent">{item.sessionId.substring(0, 14)}...</td>
                    <td className="py-2.5 px-3 font-semibold text-fg">{item.toolCall.tool}()</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-2xs font-bold px-2 py-0.5 rounded ${
                          item.status === 'APPROVED'
                            ? 'bg-ok-solid text-ok border border-ok-solid/40'
                            : item.status === 'DENIED'
                            ? 'bg-danger-solid text-danger border border-danger-solid/40'
                            : item.status === 'EXPIRED'
                            ? 'bg-raised text-muted border border-line-strong'
                            : 'bg-warn-solid text-warn border border-warn-solid/40'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-fg2 font-sans">{item.decisionNotes || item.reason}</td>
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
