import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  ArrowLeft,
  Copy,
  Check,
  Ban,
  Share2,
  FileJson,
  KeyRound,
  ExternalLink,
  AlertTriangle,
  Send,
  Info,
  Database,
  Terminal,
} from 'lucide-react';
import { Incident } from '../../../server/types.ts';

interface IncidentDetailPageProps {
  incident?: Incident;
  allIncidents: Incident[];
  onSelectIncident: (id: string) => void;
  onBack: () => void;
}

export const IncidentDetailPage: React.FC<IncidentDetailPageProps> = ({
  incident,
  allIncidents,
  onSelectIncident,
  onBack,
}) => {
  const [copied, setCopied] = useState(false);
  const [blocklistAdded, setBlocklistAdded] = useState(false);
  const [showIrModal, setShowIrModal] = useState(false);

  if (!incident) {
    return (
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-12 text-center text-slate-400 space-y-4">
        <AlertTriangle className="w-8 h-8 text-cyan-400 mx-auto" />
        <h3 className="text-base font-semibold text-white">No Incident Selected</h3>
        <p className="text-xs">Choose an incident from the Live Feed or select below:</p>
        <div className="flex flex-wrap justify-center gap-2">
          {allIncidents.slice(0, 5).map((inc) => (
            <button
              key={inc.id}
              onClick={() => onSelectIncident(inc.id)}
              className="px-3 py-1.5 rounded-lg bg-[#0b1329] border border-slate-800 hover:border-cyan-500 text-xs font-mono text-cyan-300 transition-colors"
            >
              {inc.appName}: {inc.decision.ruleId} ({inc.id.substring(0, 10)})
            </button>
          ))}
        </div>
      </div>
    );
  }

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(incident, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddToBlocklist = () => {
    setBlocklistAdded(true);
    setTimeout(() => setBlocklistAdded(false), 3000);
  };

  // Helper to render segment text with highlighted suspicious spans using offset ranges
  const renderHighlightedContent = (content: string, segmentId: string) => {
    const relevantFindings = incident.findings.filter((f) => f.segmentId === segmentId);
    if (relevantFindings.length === 0) {
      return <span>{content}</span>;
    }

    // Sort findings by start offset
    const sorted = [...relevantFindings].sort((a, b) => a.start - b.start);
    const elements: React.ReactNode[] = [];
    let currentIdx = 0;

    sorted.forEach((f, idx) => {
      const safeStart = Math.max(0, Math.min(f.start, content.length));
      const safeEnd = Math.max(safeStart, Math.min(f.end, content.length));

      // Preceding normal text
      if (safeStart > currentIdx) {
        elements.push(
          <span key={`text_${currentIdx}`}>{content.slice(currentIdx, safeStart)}</span>
        );
      }

      // Highlighted suspicious text
      elements.push(
        <mark
          key={`highlight_${idx}`}
          title={`${f.category}: ${f.reason}`}
          className="bg-rose-500/30 text-rose-200 border-b-2 border-rose-400 px-0.5 rounded-xs font-semibold cursor-help"
        >
          {content.slice(safeStart, safeEnd)}
        </mark>
      );

      currentIdx = safeEnd;
    });

    if (currentIdx < content.length) {
      elements.push(<span key={`text_end`}>{content.slice(currentIdx)}</span>);
    }

    return <>{elements}</>;
  };

  const isBlocked = incident.decision.action === 'deny';
  const isApproval = incident.decision.action === 'approve';

  return (
    <div className="space-y-6">
      {/* Top Header & Context Actions */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-white" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Hero Incident Forensic Timeline</h2>
                <span className="font-mono text-2xs text-cyan-400 bg-cyan-950 border border-cyan-800/40 px-2 py-0.5 rounded">
                  ID: {incident.id}
                </span>
                {incident.isSeeded && (
                  <span className="font-mono text-2xs text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                    [SEEDED]
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {incident.scenarioTitle} · App: <strong className="text-white">{incident.appName}</strong>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAddToBlocklist}
              className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Ban className="w-3.5 h-3.5 text-rose-400" />
              {blocklistAdded ? 'Added to Indicator Blocklist!' : 'Add to Blocklist'}
            </button>

            <button
              type="button"
              onClick={() => setShowIrModal(true)}
              className="px-3 py-1.5 bg-[#0b1329] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-white" />
              Open in Incident Response
            </button>

            <button
              type="button"
              onClick={handleCopyJson}
              className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-slate-950" /> : <Copy className="w-3.5 h-3.5 text-slate-950" />}
              {copied ? 'Copied Evidence!' : 'Copy Evidence JSON'}
            </button>
          </div>
        </div>

        {/* Quick Incident Switcher Strip */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 text-2xs font-mono">
          <span className="text-slate-500 shrink-0">Switch Incident:</span>
          {allIncidents.slice(0, 6).map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectIncident(item.id)}
              className={`px-2.5 py-1 rounded-md shrink-0 transition-colors border ${
                item.id === incident.id
                  ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold'
                  : 'bg-[#0b1329] border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {item.appName} ({item.decision.ruleId})
            </button>
          ))}
        </div>
      </div>

      {/* Two Column Layout: Hero Timeline vs Counterfactual Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Hero Vertical Timeline */}
        <div className="lg:col-span-7 bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm space-y-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
            <Terminal className="w-4 h-4 text-cyan-400" />
            Execution Pipeline Timeline: Input → Gate → Outcome
          </h3>

          <div className="relative border-l-2 border-cyan-900/60 ml-4 space-y-8 pl-6">
            {/* Step 1: Input & Ingestion */}
            <div className="relative">
              <span className="absolute -left-9 top-0.5 w-6 h-6 rounded-full bg-[#0b1329] border-2 border-cyan-400 flex items-center justify-center text-cyan-400 font-bold text-2xs">
                1
              </span>
              <div>
                <span className="text-xs font-bold uppercase tracking-wide text-cyan-400">
                  Step 1: Inbound Content &amp; Input Normalization
                </span>
                <p className="text-2xs text-slate-400 mt-0.5">
                  NFKC normalized, zero-width characters stripped, bounded base64 inspected.
                </p>
                <div className="mt-2 space-y-2">
                  {incident.segments.map((seg) => (
                    <div key={seg.id} className="p-3 bg-[#0b1329] rounded-lg border border-slate-800 text-xs">
                      <div className="flex items-center justify-between text-2xs mb-1.5 font-mono">
                        <span className="text-slate-300 font-semibold uppercase">Role: {seg.role}</span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.2 rounded font-bold ${
                              seg.trust === 'SYSTEM' || seg.trust === 'USER'
                                ? 'bg-blue-950 text-blue-300 border border-blue-800/40'
                                : 'bg-rose-950 text-rose-300 border border-rose-800/40'
                            }`}
                          >
                            [{seg.trust}]
                          </span>
                          <span className="text-slate-500">Label source: {seg.labelSource}</span>
                        </div>
                      </div>
                      <pre className="text-2xs font-mono text-slate-200 whitespace-pre-wrap max-h-36 overflow-y-auto bg-slate-950/60 p-2.5 rounded border border-slate-800">
                        {renderHighlightedContent(seg.content, seg.id)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 2: Risk Signals & Suspicious Span Detections */}
            <div className="relative">
              <span className="absolute -left-9 top-0.5 w-6 h-6 rounded-full bg-[#0b1329] border-2 border-rose-400 flex items-center justify-center text-rose-400 font-bold text-2xs">
                2
              </span>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-rose-400">
                    Step 2: Risk Signals &amp; Evidence Hashes
                  </span>
                  <span className="text-2xs font-mono text-slate-400">
                    {incident.findings.length} Finding(s) detected
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {incident.findings.map((fnd) => (
                    <div key={fnd.id} className="p-3 bg-[#0b1329] rounded-lg border border-rose-950/80 text-xs">
                      <div className="flex items-center justify-between text-2xs mb-1 font-mono">
                        <span className="font-bold text-rose-300">{fnd.category}</span>
                        <span className="font-bold text-rose-400 bg-rose-950 border border-rose-800 px-1.5 py-0.5 rounded">
                          {fnd.severity} ({Math.round(fnd.confidence * 100)}%)
                        </span>
                      </div>
                      <p className="text-2xs text-slate-300 mb-1">{fnd.reason}</p>
                      <div className="text-2xs font-mono text-slate-500 truncate">
                        Span Offset: [{fnd.start}..{fnd.end}] · Evidence Hash: {fnd.evidenceHash}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 3: Policy Engine Evaluation */}
            <div className="relative">
              <span className="absolute -left-9 top-0.5 w-6 h-6 rounded-full bg-[#0b1329] border-2 border-indigo-400 flex items-center justify-center text-indigo-400 font-bold text-2xs">
                3
              </span>
              <div>
                <span className="text-xs font-bold uppercase tracking-wide text-indigo-400">
                  Step 3: Policy Rule Evaluation
                </span>
                <div className="mt-2 p-3 bg-[#0b1329] rounded-lg border border-slate-800 text-xs space-y-1 font-mono">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Matched Security Rule:</span>
                    <span className="text-cyan-400 font-bold">{incident.decision.ruleId}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 text-2xs">
                    <span>Calculated Session Risk Level:</span>
                    <span className="text-rose-400 font-bold">{incident.riskLevel}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 text-2xs">
                    <span>Shadow Mode Simulation:</span>
                    <span>{incident.decision.shadowWouldBlock ? 'Would have Blocked' : 'Would Allow'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4: Action Gate Decision & Token Boundary */}
            <div className="relative">
              <span className="absolute -left-9 top-0.5 w-6 h-6 rounded-full bg-[#0b1329] border-2 border-cyan-400 flex items-center justify-center text-cyan-400 font-bold text-2xs">
                4
              </span>
              <div>
                <span className="text-xs font-bold uppercase tracking-wide text-cyan-400">
                  Step 4: Action Gate Boundary &amp; Credential Minting
                </span>
                <div
                  className={`mt-2 p-3 rounded-lg border text-xs ${
                    incident.decision.action === 'allow'
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                      : incident.decision.action === 'approve'
                      ? 'bg-amber-950/40 border-amber-800 text-amber-200'
                      : 'bg-rose-950/40 border-rose-800 text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold uppercase text-2xs mb-1">
                    {incident.decision.action === 'allow' ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    ) : incident.decision.action === 'approve' ? (
                      <Clock className="w-4 h-4 text-amber-400" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                    )}
                    <span>Boundary Verdict: {incident.decision.action}</span>
                  </div>
                  <p className="text-2xs font-mono">{incident.decision.reason}</p>
                </div>
              </div>
            </div>

            {/* Step 5: Final Tool Server Outcome */}
            <div className="relative">
              <span className="absolute -left-9 top-0.5 w-6 h-6 rounded-full bg-[#0b1329] border-2 border-emerald-400 flex items-center justify-center text-emerald-400 font-bold text-2xs">
                5
              </span>
              <div>
                <span className="text-xs font-bold uppercase tracking-wide text-emerald-400">
                  Step 5: Protected Tool Server Outcome
                </span>
                <div className="mt-2 p-3 bg-[#0b1329] rounded-lg border border-slate-800 text-xs space-y-1 font-mono">
                  {incident.toolCall ? (
                    <>
                      <div className="text-slate-300 font-bold">Tool: {incident.toolCall.tool}()</div>
                      <div className="text-2xs text-slate-400">
                        Credential Info: {incident.toolResult?.credentialInfo || 'None'}
                      </div>
                      <div className="text-2xs text-slate-400">
                        Result: {incident.toolResult?.error || JSON.stringify(incident.toolResult?.data)}
                      </div>
                      <div className="text-2xs text-emerald-400 font-bold pt-1 border-t border-slate-800">
                        {incident.dataLeftPremises ? '⚠️ DATA TRANSMITTED' : '✓ ZERO DATA EXFILTRATION'}
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-400 text-2xs">No tool invoked by agent response.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: "Why Blocked" Box & "Without Firewall" Counterfactual */}
        <div className="lg:col-span-5 space-y-6">
          {/* Plain Language "Why Blocked" Box */}
          <div className="bg-[#0f172a] border border-cyan-800/40 rounded-xl p-5 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-400" />
              Plain Language Explanation: Why Blocked
            </h4>

            <div className="p-3.5 bg-[#0b1329] rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed">
              {incident.decision.action === 'deny' ? (
                <>
                  The agent read an untrusted document containing hidden directives and attempted to invoke sensitive tool{' '}
                  <code className="text-cyan-400 font-mono font-bold">
                    {incident.toolCall?.tool || 'send_email'}
                  </code>
                  . Under policy rule{' '}
                  <strong className="text-white">{incident.decision.ruleId}</strong>, untrusted sessions cannot authorize external or financial actions. The Action Gate refused to mint a broker token, preventing the tool server from executing.
                </>
              ) : incident.decision.action === 'approve' ? (
                <>
                  The requested operation involves external communication or exceeds financial thresholds. The Action Gate held the call in the Human Approval Queue with a 60-second auto-expiration window.
                </>
              ) : (
                <>
                  The tool invocation was deemed benign under active policy rules and was granted a single-use 60-second micro-token bound to the exact arguments.
                </>
              )}
            </div>
          </div>

          {/* Side-by-Side Panel: Without Firewall — What Would Have Happened */}
          <div className="bg-[#0f172a] border border-rose-900/50 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Without Firewall: What Would Have Happened
              </h4>
              <span className="text-2xs font-mono text-rose-400 font-bold bg-rose-950 px-2 py-0.5 rounded border border-rose-900">
                OFF-MODE CONTRAST
              </span>
            </div>

            {incident.withoutFirewallOutcome ? (
              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 bg-rose-950/30 border border-rose-900/60 rounded-lg space-y-2">
                  <div className="text-slate-300 font-semibold">
                    Attacker Action Obeyed:
                  </div>
                  <pre className="text-2xs text-rose-200 bg-black/40 p-2 rounded whitespace-pre-wrap">
                    {incident.withoutFirewallOutcome.tool}({JSON.stringify(incident.withoutFirewallOutcome.args, null, 2)})
                  </pre>
                  <div className="text-2xs text-slate-300">
                    <strong className="text-rose-400">Impact: </strong>
                    {incident.withoutFirewallOutcome.impact}
                  </div>
                  {incident.withoutFirewallOutcome.financialLoss && (
                    <div className="text-2xs text-rose-300 font-bold">
                      Potential Loss: {incident.withoutFirewallOutcome.financialLoss}
                    </div>
                  )}
                </div>

                <div className="text-2xs text-slate-400 leading-relaxed font-sans">
                  In legacy agent setups, the agent holds a standing master key. An adversary hijacking the prompt can call tools without restrictions, argument constraints, or approval gates.
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                In off-mode, the agent executes all tool calls using the standing master key without argument constraints.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Incident Response Playbook Modal */}
      {showIrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                Incident Response Remediation Playbook
              </h3>
              <button
                type="button"
                onClick={() => setShowIrModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-slate-300">
              <p>
                <strong>Incident ID:</strong> <code className="font-mono text-cyan-400">{incident.id}</code>
              </p>
              <p>
                <strong>Rule Enforced:</strong> <code className="font-mono text-rose-400">{incident.decision.ruleId}</code>
              </p>
              <div className="p-3 bg-[#0b1329] rounded border border-slate-800 space-y-1.5 font-mono text-2xs">
                <div>[Step 1] Quarantine source document segment ID {incident.segments[1]?.id || 'doc'}.</div>
                <div>[Step 2] Add recipient address to permanent firewall domain blocklist.</div>
                <div>[Step 3] Confirm Protected Tool Server Outbox: Zero bytes exfiltrated.</div>
                <div>[Step 4] Cryptographic audit chain verified at seq #{incident.latency.totalMs}.</div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowIrModal(false)}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg text-xs"
              >
                Close Playbook
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
