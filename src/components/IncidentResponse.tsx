import React, { useEffect, useState } from 'react';
import {
  FileText,
  AlertOctagon,
  ShieldAlert,
  ShieldCheck,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  CheckCircle2,
  Copy,
  Info,
  Radio,
  Clock,
} from 'lucide-react';
import {
  fetchBlastRadiusGraph,
  fetchKillSwitchState,
  toggleKillSwitch,
  fetchReportDrafts,
  fetchTimeline,
  fetchIncidents,
} from '../services/api.ts';

export const IncidentResponse: React.FC = () => {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('');
  const [graph, setGraph] = useState<any | null>(null);
  const [killSwitch, setKillSwitch] = useState<any | null>(null);
  const [reportDrafts, setReportDrafts] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [activeReportTab, setActiveReportTab] = useState<'cert_in' | 'dpdp'>('cert_in');
  const [copiedDraft, setCopiedDraft] = useState(false);

  // Replay animation state
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    fetchIncidents()
      .then((data) => {
        const list = Array.isArray(data) ? data : (data as any)?.incidents || [];
        setIncidents(list);
        if (list.length > 0) {
          setSelectedIncidentId(list[0].id);
        }
      })
      .catch((err) => console.error('Failed to load incidents:', err));

    loadKillSwitch();
  }, []);

  useEffect(() => {
    if (selectedIncidentId) {
      loadIncidentData(selectedIncidentId);
    }
  }, [selectedIncidentId]);

  const loadKillSwitch = async () => {
    try {
      const data = await fetchKillSwitchState();
      setKillSwitch(data);
    } catch (err) {
      console.error('Failed to load kill-switch state:', err);
    }
  };

  const loadIncidentData = async (id: string) => {
    try {
      const [gData, rData, tData] = await Promise.all([
        fetchBlastRadiusGraph(id),
        fetchReportDrafts(id),
        fetchTimeline(id),
      ]);
      setGraph(gData.graph);
      setReportDrafts(rData.drafts);
      setTimeline(tData.timeline);
      setCurrentStep(tData.timeline.length);
    } catch (err) {
      console.error('Failed to load incident detail data:', err);
    }
  };

  // Replay animation interval
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= timeline.length) {
            setIsPlaying(false);
            return timeline.length;
          }
          return prev + 1;
        });
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, timeline.length]);

  const handleToggleKillSwitch = async (agentId: string, currentQuarantined: boolean) => {
    try {
      await toggleKillSwitch(
        agentId,
        !currentQuarantined,
        !currentQuarantined ? 'Operator manual security quarantine' : 'Quarantine lifted'
      );
      await loadKillSwitch();
      if (selectedIncidentId) await loadIncidentData(selectedIncidentId);
    } catch (err) {
      console.error('Failed to toggle kill switch:', err);
    }
  };

  const currentAgentId = graph?.nodes?.find((n: any) => n.type === 'agent')?.id || 'agent_s1_hr_resume_exfil';
  const isAgentQuarantined = killSwitch?.quarantinedAgents?.includes(currentAgentId) || false;

  const handleCopyDraft = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Incident Selector & Top Summary */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-indigo-600" />
              AI Incident Response &amp; Blast-Radius Containment
              <span className="text-2xs font-mono text-slate-500 font-normal">
                [BUILT: Interactive Graph &amp; Kill-Switch]
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualize affected data dependencies, execute emergency agent quarantine, and generate compliant legal breach intimation drafts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Select Incident:</span>
            <select
              value={selectedIncidentId}
              onChange={(e) => setSelectedIncidentId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-mono"
            >
              {incidents.length === 0 ? (
                <option value="">No incidents recorded yet</option>
              ) : (
                incidents.map((inc) => (
                  <option key={inc.id} value={inc.id}>
                    {inc.scenarioTitle} ({inc.id.slice(0, 10)})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Emergency Kill-Switch Bar */}
        <div
          className={`p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isAgentQuarantined
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200 text-rose-950'
              : 'bg-slate-50 border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-md ${
                isAgentQuarantined ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Target Agent Kill-Switch:
                </span>
                <span className="font-mono text-xs font-bold text-slate-800">
                  {currentAgentId}
                </span>
                <span
                  className={`text-2xs font-bold px-2 py-0.5 rounded font-mono ${
                    isAgentQuarantined ? 'bg-rose-200 text-rose-900' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {isAgentQuarantined ? 'QUARANTINED & FROZEN' : 'ACTIVE & NOMINAL'}
                </span>
              </div>
              <p className="text-2xs text-slate-600 mt-0.5">
                Quarantining revokes all short-lived broker keys immediately and blocks subsequent execution attempts at the Action Gate.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleToggleKillSwitch(currentAgentId, isAgentQuarantined)}
            className={`px-3.5 py-2 rounded text-xs font-bold shadow-xs transition-colors shrink-0 ${
              isAgentQuarantined
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white'
            }`}
          >
            {isAgentQuarantined ? 'Lift Agent Quarantine' : 'ACTIVATE KILL-SWITCH'}
          </button>
        </div>
      </div>

      {/* 2. Interactive SVG Blast-Radius Graph */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
        <div className="border-b border-slate-200 pb-3 mb-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Radio className="w-4 h-4 text-indigo-600" />
            Incident Blast-Radius Graph
            <span className="text-2xs font-mono text-slate-500 font-normal">
              [BUILT: Vector Containment Map]
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Traces the propagation path from prompt injection ingress to internal sensitive databases and external egress channels.
          </p>
        </div>

        {graph ? (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg overflow-x-auto">
            <svg className="w-full min-w-[650px] h-52" viewBox="0 0 700 180">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                </marker>
                <marker id="arrow-blocked" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#e11d48" />
                </marker>
              </defs>

              {/* Connecting Edges */}
              {/* Edge 1: Session -> Agent */}
              <line x1="120" y1="90" x2="220" y2="90" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrow)" />
              {/* Edge 2: Agent -> Tool */}
              <line x1="330" y1="90" x2="410" y2="90" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrow)" />
              {/* Edge 3: Tool -> Data Object (Upward) */}
              <path d="M 460 70 L 460 45 L 530 45" fill="none" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrow)" />
              {/* Edge 4: Tool -> Outbound Sink (Downward) */}
              <path
                d="M 460 110 L 460 135 L 530 135"
                fill="none"
                stroke={graph.nodes.find((n: any) => n.id === 'dest_external')?.status === 'compromised' ? '#e11d48' : '#10b981'}
                strokeWidth="2"
                strokeDasharray={graph.nodes.find((n: any) => n.id === 'dest_external')?.status === 'compromised' ? 'none' : '3 3'}
                markerEnd={graph.nodes.find((n: any) => n.id === 'dest_external')?.status === 'compromised' ? 'url(#arrow-blocked)' : 'url(#arrow)'}
              />

              {/* Node 1: Session */}
              <g transform="translate(20, 65)">
                <rect width="100" height="50" rx="6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                <text x="50" y="24" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a">Ingress Session</text>
                <text x="50" y="38" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#64748b">Tainted Input</text>
              </g>

              {/* Node 2: Agent */}
              <g transform="translate(220, 65)">
                <rect
                  width="110"
                  height="50"
                  rx="6"
                  fill="#ffffff"
                  stroke={isAgentQuarantined ? '#e11d48' : '#6366f1'}
                  strokeWidth="2"
                />
                <text x="55" y="24" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a">AI Agent</text>
                <text x="55" y="38" textAnchor="middle" fontSize="8" fontFamily="monospace" fill={isAgentQuarantined ? '#e11d48' : '#6366f1'}>
                  {isAgentQuarantined ? 'QUARANTINED' : 'ACTIVE'}
                </text>
              </g>

              {/* Node 3: Proposed Tool */}
              <g transform="translate(410, 65)">
                <rect width="100" height="50" rx="6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                <text x="50" y="24" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a">Action Gate</text>
                <text x="50" y="38" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#4338ca">Tool Boundary</text>
              </g>

              {/* Node 4: Private Data Object */}
              <g transform="translate(530, 20)">
                <rect width="150" height="46" rx="6" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.5" />
                <text x="75" y="22" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a">Candidate Database</text>
                <text x="75" y="36" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#059669">Internal Perimeter</text>
              </g>

              {/* Node 5: Outbound Destination */}
              <g transform="translate(530, 110)">
                {(() => {
                  const destNode = graph.nodes.find((n: any) => n.id === 'dest_external');
                  const isCompromised = destNode?.status === 'compromised';
                  return (
                    <>
                      <rect
                        width="150"
                        height="46"
                        rx="6"
                        fill={isCompromised ? '#fef2f2' : '#ecfdf5'}
                        stroke={isCompromised ? '#e11d48' : '#10b981'}
                        strokeWidth="2"
                      />
                      <text x="75" y="22" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a">
                        External Sink
                      </text>
                      <text
                        x="75"
                        y="36"
                        textAnchor="middle"
                        fontSize="8"
                        fontFamily="monospace"
                        fontWeight="bold"
                        fill={isCompromised ? '#e11d48' : '#059669'}
                      >
                        {isCompromised ? 'EXFILTRATED' : 'CONTAINED BY GATE'}
                      </text>
                    </>
                  );
                })()}
              </g>
            </svg>
          </div>
        ) : (
          <div className="text-xs text-slate-500 py-6 text-center">No graph data.</div>
        )}
      </div>

      {/* 3. Timeline Replay Scrubber */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              Incident Timeline Replay Engine
              <span className="text-2xs font-mono text-slate-500 font-normal">
                [BUILT: Step-by-Step State Reconstruction]
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Step forward and backward through the execution sequence to inspect exactly how the Action Gate contained the attack.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCurrentStep(1);
                setIsPlaying(false);
              }}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              {isPlaying ? 'Pause' : 'Play Replay'}
            </button>
            <button
              type="button"
              disabled={currentStep >= timeline.length}
              onClick={() => setCurrentStep((prev) => Math.min(timeline.length, prev + 1))}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded text-xs font-semibold flex items-center gap-1"
            >
              <SkipForward className="w-3.5 h-3.5" />
              Step
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          {timeline.map((step) => {
            const isReached = currentStep >= step.step;
            const isCurrent = currentStep === step.step;
            return (
              <div
                key={step.step}
                className={`p-3 rounded-lg border transition-all ${
                  isCurrent
                    ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200'
                    : isReached
                    ? 'bg-white border-slate-200'
                    : 'bg-slate-50 border-slate-200 opacity-40'
                }`}
              >
                <div className="flex items-center justify-between text-2xs mb-1">
                  <span className="font-mono font-bold text-indigo-700">Step {step.step}</span>
                  <span className="font-mono text-3xs text-slate-400">T+{step.timeOffsetMs}ms</span>
                </div>
                <div className="text-xs font-bold text-slate-900 mb-1">{step.title}</div>
                <p className="text-3xs text-slate-600 leading-relaxed">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. CERT-In & DPDP Legal Report Drafts */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              Regulatory Incident Report Generator
              <span className="text-2xs font-mono text-slate-500 font-normal">
                [BUILT: CERT-In 70B &amp; DPDP 2023 Drafts]
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Automates technical incident intake drafts for compliance review.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-slate-300 p-0.5 bg-slate-100 text-2xs">
              <button
                type="button"
                onClick={() => setActiveReportTab('cert_in')}
                className={`py-1 px-3 rounded font-medium transition-colors ${
                  activeReportTab === 'cert_in' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700'
                }`}
              >
                CERT-In (6-Hr Notice)
              </button>
              <button
                type="button"
                onClick={() => setActiveReportTab('dpdp')}
                className={`py-1 px-3 rounded font-medium transition-colors ${
                  activeReportTab === 'dpdp' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700'
                }`}
              >
                DPDP 2023 Notice
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const text =
                  activeReportTab === 'cert_in'
                    ? JSON.stringify(reportDrafts?.certInDraft, null, 2)
                    : JSON.stringify(reportDrafts?.dpdpDraft, null, 2);
                handleCopyDraft(text);
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-semibold flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedDraft ? 'Copied!' : 'Copy Draft'}
            </button>
          </div>
        </div>

        {/* Mandatory Legal Review Disclaimer Banner */}
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-md text-xs flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="font-medium">
            Draft for legal and security review. Not legal advice. Verify deadlines and applicability with counsel.
          </div>
        </div>

        {reportDrafts && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-3 font-mono">
            {activeReportTab === 'cert_in' ? (
              <div className="space-y-3">
                <div className="text-sm font-bold text-slate-900 font-sans">
                  {reportDrafts.certInDraft.title}
                </div>
                <div className="text-2xs text-slate-500 font-sans">
                  {reportDrafts.certInDraft.reportingTimeline}
                </div>
                <div className="p-3 bg-white rounded border border-slate-200 space-y-1.5 text-2xs">
                  <div><strong>Affected System:</strong> {reportDrafts.certInDraft.affectedSystem}</div>
                  <div><strong>Incident Category:</strong> {reportDrafts.certInDraft.incidentCategory}</div>
                  <div><strong>Vulnerability:</strong> {reportDrafts.certInDraft.vulnerabilityIdentified}</div>
                  <div className="pt-2"><strong>Chronology of Events:</strong></div>
                  <ul className="list-disc pl-5 text-slate-700">
                    {reportDrafts.certInDraft.chronologyOfEvents.map((c: string, idx: number) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                  <div className="pt-2"><strong>Mitigation Actions Implemented:</strong></div>
                  <ul className="list-disc pl-5 text-slate-700">
                    {reportDrafts.certInDraft.mitigationActions.map((m: string, idx: number) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm font-bold text-slate-900 font-sans">
                  {reportDrafts.dpdpDraft.title}
                </div>
                <div className="text-2xs text-slate-500 font-sans">
                  {reportDrafts.dpdpDraft.regulatoryReference}
                </div>
                <div className="p-3 bg-white rounded border border-slate-200 space-y-1.5 text-2xs">
                  <div><strong>Data Protection Board Notice:</strong> {reportDrafts.dpdpDraft.dataProtectionBoardNotice}</div>
                  <div><strong>Affected Data Principals:</strong> {reportDrafts.dpdpDraft.affectedDataPrincipals}</div>
                  <div><strong>Compromised Data Elements:</strong> {reportDrafts.dpdpDraft.compromisedDataElements.join(', ')}</div>
                  <div><strong>Action Gate Containment Status:</strong> {reportDrafts.dpdpDraft.actionGateContainmentStatus}</div>
                  <div className="pt-2"><strong>Remedial Measures Implemented:</strong></div>
                  <ul className="list-disc pl-5 text-slate-700">
                    {reportDrafts.dpdpDraft.remedialMeasuresImplemented.map((m: string, idx: number) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
