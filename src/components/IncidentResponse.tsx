import React, { useEffect, useMemo, useState } from 'react';
import { FileText, AlertOctagon, Play, Pause, RotateCcw, SkipForward, Copy, Info, Radio, Clock, Download } from 'lucide-react';
import {
  fetchBlastRadiusGraph,
  fetchKillSwitchState,
  toggleKillSwitch,
  fetchReportDrafts,
  fetchTimeline,
  fetchIncidents,
  downloadEvidenceBundle,
} from '../services/api.ts';

const STATUS_COLOR: Record<string, { fill: string; stroke: string; text: string }> = {
  allowed: { fill: '#fef2f2', stroke: '#e11d48', text: '#9f1239' },
  blocked: { fill: '#ecfdf5', stroke: '#10b981', text: '#065f46' },
  pending: { fill: '#fffbeb', stroke: '#f59e0b', text: '#92400e' },
  revoked: { fill: '#f5f3ff', stroke: '#8b5cf6', text: '#5b21b6' },
  expired: { fill: '#f1f5f9', stroke: '#94a3b8', text: '#475569' },
  rejected: { fill: '#ecfdf5', stroke: '#10b981', text: '#065f46' },
  info: { fill: '#ffffff', stroke: '#cbd5e1', text: '#334155' },
};
const EDGE_COLOR: Record<string, string> = { allowed: '#e11d48', blocked: '#10b981', pending: '#f59e0b', revoked: '#8b5cf6' };
const COLUMN: Record<string, number> = { untrusted_source: 0, session: 1, tool_call: 2, data_object: 3, token: 3, outbound_destination: 4 };
const COLUMN_TITLE = ['Untrusted sources', 'Session', 'Tool calls', 'Data touched / tokens', 'Destinations'];

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

  // Replay uses the REAL event timestamps: the wait before step N+1 is the recorded gap (sped up, clamped)
  const [speed, setSpeed] = useState<number>(4);
  useEffect(() => {
    if (!isPlaying) return;
    if (currentStep >= timeline.length) {
      setIsPlaying(false);
      return;
    }
    const gap = (timeline[currentStep]?.timeOffsetMs ?? 0) - (timeline[currentStep - 1]?.timeOffsetMs ?? 0);
    const wait = Math.min(2000, Math.max(250, gap / speed));
    const t = setTimeout(() => setCurrentStep((p) => Math.min(timeline.length, p + 1)), wait);
    return () => clearTimeout(t);
  }, [isPlaying, currentStep, timeline, speed]);

  // Layered layout computed from the real nodes
  const layout = useMemo(() => {
    const nodes: any[] = graph?.nodes ?? [];
    const cols: any[][] = [[], [], [], [], []];
    for (const n of nodes) cols[COLUMN[n.type] ?? 3].push(n);
    const pos = new Map<string, { x: number; y: number }>();
    cols.forEach((col, ci) => col.forEach((n, i) => pos.set(n.id, { x: 20 + ci * 190, y: 34 + i * 50 })));
    const rows = Math.max(1, ...cols.map((c) => c.length));
    return { pos, height: 50 + rows * 50 };
  }, [graph]);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

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

  const selectedIncident = incidents.find((i) => i.id === selectedIncidentId);
  const currentAgentId = selectedIncident ? `agent_${selectedIncident.scenarioId}` : 'agent_s1_hr_resume_exfil';
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
                Quarantining revokes every outstanding broker token of the agent (each revocation is logged) and blocks subsequent execution attempts at the Action Gate.
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

      {/* 2. Blast radius computed from the real event ledger */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Radio className="w-4 h-4 text-indigo-600" />
              Blast Radius (computed from the event ledger)
              <span className="text-2xs font-mono text-slate-500 font-normal">[BUILT: nodes exist only if an event created them]</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Red = something really happened (data read / sent). Green = blocked. Amber = held for approval. Purple = revoked token. Grey = expired.
            </p>
          </div>
          <button
            type="button"
            disabled={!selectedIncidentId}
            onClick={() => downloadEvidenceBundle(selectedIncidentId).catch(console.error)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Download evidence bundle (JSON)
          </button>
        </div>

        {graph?.note && <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded text-xs">{graph.note}</div>}

        {graph && graph.nodes.length > 0 ? (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg overflow-x-auto">
            <svg className="min-w-[980px] w-full" viewBox={`0 0 980 ${layout.height}`} style={{ height: layout.height }}>
              {COLUMN_TITLE.map((t, i) => (
                <text key={t} x={20 + i * 190} y={14} fontSize="9" fill="#64748b" fontWeight="bold">{t}</text>
              ))}
              {graph.edges.map((e: any) => {
                const a = layout.pos.get(e.source);
                const b = layout.pos.get(e.target);
                if (!a || !b) return null;
                return (
                  <g key={e.id}>
                    <line x1={a.x + 150} y1={a.y + 17} x2={b.x} y2={b.y + 17} stroke={EDGE_COLOR[e.status] ?? '#94a3b8'} strokeWidth="1.5" strokeDasharray={e.status === 'blocked' ? '4 3' : 'none'} />
                    <text x={(a.x + 150 + b.x) / 2} y={(a.y + b.y) / 2 + 14} fontSize="7" textAnchor="middle" fill="#475569">{e.label}</text>
                  </g>
                );
              })}
              {graph.nodes.map((n: any) => {
                const p = layout.pos.get(n.id)!;
                const c = STATUS_COLOR[n.status] ?? STATUS_COLOR.info;
                return (
                  <g key={n.id} transform={`translate(${p.x}, ${p.y})`} onClick={() => setSelectedNode(n)} style={{ cursor: 'pointer' }}>
                    <rect width="150" height="34" rx="5" fill={c.fill} stroke={c.stroke} strokeWidth="1.5" />
                    <text x="75" y="14" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#0f172a">{String(n.label).slice(0, 26)}</text>
                    <text x="75" y="26" textAnchor="middle" fontSize="7.5" fontFamily="monospace" fill={c.text}>{n.type.replace('_', ' ')} · {n.status}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <div className="text-xs text-slate-500 py-6 text-center">No ledger events for this incident.</div>
        )}

        {selectedNode && (
          <pre className="mt-3 p-3 bg-slate-900 text-slate-100 rounded text-3xs overflow-x-auto max-h-48">{JSON.stringify(selectedNode, null, 2)}</pre>
        )}

        {graph && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="p-3 border border-rose-200 bg-rose-50 rounded-lg text-xs">
              <div className="font-bold text-rose-900 mb-1">What left the premises</div>
              {graph.summary.leftPremises.items.length === 0 ? (
                <div className="text-emerald-800">Nothing, according to the outbox / refund records and the ledger.</div>
              ) : (
                <ul className="space-y-1 text-rose-950">
                  {graph.summary.leftPremises.items.map((i: any) => (
                    <li key={i.callId} className="font-mono text-2xs">
                      {i.kind === 'email' ? `email → ${(i.recipients ?? []).join(', ')} · ${i.bytes ?? '?'} bytes` : `refund INR ${i.amount} → ${i.upiId}`}
                      {' · classes: '}{Object.entries(i.dataClasses).map(([k, v]) => `${k}×${v}`).join(', ') || 'none found'}
                      {' · source: '}{i.source}{i.simulation ? ` (${i.simulation})` : ''}
                    </li>
                  ))}
                  <li className="text-2xs">Totals: {graph.summary.leftPremises.recipients.length} recipient(s), {graph.summary.leftPremises.totalBytes} bytes, {graph.summary.leftPremises.recordsReferenced} record id(s) in bodies; {graph.summary.leftPremises.recordsTouchedInSession} record(s) read in session.</li>
                </ul>
              )}
            </div>
            <div className="p-3 border border-emerald-200 bg-emerald-50 rounded-lg text-xs">
              <div className="font-bold text-emerald-900 mb-1">What was prevented</div>
              {graph.summary.prevented.items.length === 0 ? (
                <div className="text-slate-600">No calls were denied or held in this session.</div>
              ) : (
                <ul className="space-y-1 text-emerald-950">
                  {graph.summary.prevented.items.map((i: any) => (
                    <li key={i.callId} className="font-mono text-2xs">
                      {i.status === 'pending' ? 'HELD' : 'DENIED'} {i.tool}() {i.ruleId ? `[${i.ruleId}]` : ''} → {(i.recipients ?? []).join(', ') || i.upiId || '-'}
                      {i.amount ? ` INR ${i.amount}` : ''}
                      {Object.keys(i.wouldHaveSentClasses).length ? ` · would have sent: ${Object.entries(i.wouldHaveSentClasses).map(([k, v]) => `${k}×${v}`).join(', ')}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Timeline Replay Scrubber */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              Event Replay (real timestamps)
              <span className="text-2xs font-mono text-slate-500 font-normal">
                [BUILT: from ledger event times]
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Play, pause or step through the recorded events. Gaps between steps are the real gaps between ledger timestamps (sped up).
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
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="text-xs border border-slate-300 rounded px-1.5 py-1.5 bg-white">
              <option value={1}>1x</option>
              <option value={4}>4x</option>
              <option value={16}>16x</option>
            </select>
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
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
                  <span className="font-mono text-3xs text-slate-400" title={step.ts}>T+{step.timeOffsetMs}ms</span>
                </div>
                <div className="text-3xs font-mono text-slate-400">{step.phase} · {step.status}</div>
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
                [PROTOTYPE: drafts computed from ledger data]
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Drafts are populated from the computed blast radius and events. They assert no legal deadline.
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
                CERT-In draft
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
            {reportDrafts?.disclaimer ?? 'Draft for legal and security review. Not legal advice. Verify deadlines and applicability with counsel.'}
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
