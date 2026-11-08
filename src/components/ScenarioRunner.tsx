import React, { useState } from 'react';
import {
  Play,
  ShieldCheck,
  ShieldAlert,
  AlertOctagon,
  Clock,
  ArrowRight,
  Database,
  Send,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Cpu,
} from 'lucide-react';
import { FirewallMode, Incident, LLMMode } from '../../server/types.ts';
import { ScenarioDefinition } from '../../server/scenarios.ts';
import { runAgentScenario } from '../services/api.ts';

interface ScenarioRunnerProps {
  scenarios: ScenarioDefinition[];
  firewallMode: FirewallMode;
  onFirewallModeChange: (mode: FirewallMode) => void;
  onRunComplete: (incident: Incident) => void;
  latestIncident?: Incident;
}

export const ScenarioRunner: React.FC<ScenarioRunnerProps> = ({
  scenarios,
  firewallMode,
  onFirewallModeChange,
  onRunComplete,
  latestIncident,
}) => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(
    scenarios[0]?.id || 's1_hr_resume_exfil'
  );
  const [llmMode, setLlmMode] = useState<LLMMode>('mock');
  const [loading, setLoading] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const activeScenario = scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0];

  const handleRun = async () => {
    setLoading(true);
    setRunError(null);
    try {
      const incident = await runAgentScenario({
        scenarioId: selectedScenarioId,
        firewallMode,
        llmMode,
      });
      onRunComplete(incident);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setRunError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Scenario Selection */}
          <div className="lg:col-span-5 space-y-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
              1. Select Test Scenario
            </label>
            <select
              value={selectedScenarioId}
              onChange={(e) => setSelectedScenarioId(e.target.value)}
              className="w-full text-sm bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {scenarios.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.title}
                </option>
              ))}
            </select>
            {activeScenario && (
              <p className="text-xs text-slate-500 leading-relaxed">
                {activeScenario.description}
              </p>
            )}
          </div>

          {/* Firewall Mode Switch */}
          <div className="lg:col-span-4 space-y-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
              2. Action Gate Security Mode
            </label>
            <div className="flex rounded-md border border-slate-300 p-1 bg-slate-100">
              <button
                type="button"
                onClick={() => onFirewallModeChange('enforce')}
                className={`flex-1 py-1.5 px-3 rounded text-xs font-medium transition-colors ${
                  firewallMode === 'enforce'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                ENFORCE
              </button>
              <button
                type="button"
                onClick={() => onFirewallModeChange('shadow')}
                className={`flex-1 py-1.5 px-3 rounded text-xs font-medium transition-colors ${
                  firewallMode === 'shadow'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                SHADOW
              </button>
              <button
                type="button"
                onClick={() => onFirewallModeChange('off')}
                className={`flex-1 py-1.5 px-3 rounded text-xs font-medium transition-colors ${
                  firewallMode === 'off'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                OFF
              </button>
            </div>
            <div className="text-2xs text-slate-500">
              {firewallMode === 'enforce' && 'Enforce: Deterministic gate blocks unauthorized actions and mints 60s tokens.'}
              {firewallMode === 'shadow' && 'Shadow: Permissive execution while logging would-block violations.'}
              {firewallMode === 'off' && 'Off: Uses Standing Master Key without argument checks or expiry.'}
            </div>
          </div>

          {/* Agent Engine & Run Action */}
          <div className="lg:col-span-3 space-y-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
              3. Agent Execution Engine
            </label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setLlmMode('mock')}
                className={`flex-1 py-1.5 px-2 rounded text-xs font-medium border text-center transition-colors ${
                  llmMode === 'mock'
                    ? 'bg-white border-indigo-600 text-indigo-700 ring-1 ring-indigo-600 font-semibold'
                    : 'bg-slate-50 border-slate-300 text-slate-600 hover:text-slate-900'
                }`}
              >
                Simulated Fooled Agent <span className="text-2xs font-mono font-normal">[BUILT]</span>
              </button>
              <button
                type="button"
                onClick={() => setLlmMode('gemini')}
                className={`flex-1 py-1.5 px-2 rounded text-xs font-medium border text-center transition-colors ${
                  llmMode === 'gemini'
                    ? 'bg-white border-indigo-600 text-indigo-700 ring-1 ring-indigo-600 font-semibold'
                    : 'bg-slate-50 border-slate-300 text-slate-600 hover:text-slate-900'
                }`}
              >
                Gemini 3.8 Flash <span className="text-2xs font-mono font-normal">[PROTOTYPE]</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleRun}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-md text-sm font-semibold shadow-xs transition-colors"
            >
              <Play className="w-4 h-4 fill-current" />
              {loading ? 'Evaluating Action Gate...' : 'Execute Scenario'}
            </button>
          </div>
        </div>

        {runError && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Execution failed: {runError}</span>
          </div>
        )}
      </div>

      {/* Execution Trace & Pipeline Output */}
      {latestIncident ? (
        <div className="space-y-5">
          {/* Status Header: Action Gate Outcome & Leak Status */}
          <div
            className={`border rounded-lg p-5 ${
              latestIncident.decision.action === 'allow'
                ? latestIncident.firewallMode === 'off'
                  ? 'bg-rose-50 border-rose-300'
                  : 'bg-emerald-50 border-emerald-300'
                : latestIncident.decision.action === 'approve'
                ? 'bg-amber-50 border-amber-300'
                : 'bg-rose-50 border-rose-300'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {latestIncident.decision.action === 'allow' ? (
                    latestIncident.firewallMode === 'off' ? (
                      <AlertOctagon className="w-6 h-6 text-rose-600" />
                    ) : (
                      <ShieldCheck className="w-6 h-6 text-emerald-600" />
                    )
                  ) : latestIncident.decision.action === 'approve' ? (
                    <Clock className="w-6 h-6 text-amber-600" />
                  ) : (
                    <ShieldAlert className="w-6 h-6 text-rose-600" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Action Gate Boundary Decision:
                    </span>
                    <span
                      className={`text-sm font-bold uppercase px-2 py-0.5 rounded ${
                        latestIncident.decision.action === 'allow'
                          ? 'bg-emerald-600 text-white'
                          : latestIncident.decision.action === 'approve'
                          ? 'bg-amber-600 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {latestIncident.decision.action}
                    </span>
                    <span className="text-xs font-mono text-slate-600">
                      Rule: {latestIncident.decision.ruleId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-800 mt-1 font-medium">
                    {latestIncident.decision.reason}
                  </p>
                </div>
              </div>

              {/* Data Leak Monitor Chip */}
              <div className="flex flex-col sm:items-end gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-medium">Outbox Data Leak:</span>
                  {latestIncident.dataLeftPremises ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      DATA EXFILTRATED (Transmitted)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      DATA CONTAINED (Zero Outbound Leak)
                    </span>
                  )}
                </div>
                <div className="text-2xs font-mono text-slate-500">
                  Latency: {latestIncident.latency.totalMs} ms (Norm: {latestIncident.latency.normalizationMs}ms · Detect: {latestIncident.latency.detectionMs}ms · Gate: {latestIncident.latency.policyMs}ms)
                </div>
              </div>
            </div>

            {/* Notices / Fallback banners */}
            {latestIncident.notices.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-1">
                {latestIncident.notices.map((notice, idx) => (
                  <div key={idx} className="text-xs text-slate-700 flex items-center gap-1.5">
                    <span className="text-indigo-600 font-mono">ℹ</span>
                    <span>{notice}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Three-Column Pipeline Trace */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Step 1: Input & Ingested Segments with Trust Provenance */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-indigo-600" />
                  1. Ingested Segments &amp; Trust
                </h4>
                <span className="text-2xs font-mono text-slate-500">
                  {latestIncident.segments.length} segment(s)
                </span>
              </div>

              <div className="space-y-3">
                {latestIncident.segments.map((seg) => (
                  <div key={seg.id} className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                    <div className="flex items-center justify-between text-2xs mb-1.5">
                      <span className="font-semibold text-slate-700 uppercase">
                        Role: {seg.role}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-mono font-semibold px-1.5 py-0.2 rounded text-2xs ${
                            seg.trust === 'SYSTEM' || seg.trust === 'USER'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          [{seg.trust}]
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">Label source: {seg.labelSource}</span>
                      </div>
                    </div>
                    <pre className="text-xs text-slate-800 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto bg-white p-2 rounded border border-slate-200">
                      {seg.content}
                    </pre>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 2: Multi-Detector Risk Signals */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-indigo-600" />
                  2. Risk Signals &amp; Evidence Hashes
                </h4>
                <span className="text-2xs font-mono text-slate-500">
                  {latestIncident.findings.length} Finding(s)
                </span>
              </div>

              {latestIncident.findings.length === 0 ? (
                <div className="text-xs text-slate-500 p-4 text-center">
                  No risk signals or confidential PII patterns detected.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto">
                  {latestIncident.findings.map((fnd) => (
                    <div key={fnd.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-md">
                      <div className="flex items-center justify-between text-2xs mb-1">
                        <span className="font-semibold text-slate-800">{fnd.category}</span>
                        <span
                          className={`font-mono font-bold px-1.5 py-0.2 rounded ${
                            fnd.severity === 'CRITICAL' || fnd.severity === 'HIGH'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {fnd.severity} ({Math.round(fnd.confidence * 100)}%)
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mb-1.5">{fnd.reason}</p>
                      <div className="text-2xs font-mono text-slate-400 truncate">
                        Evidence Hash: {fnd.evidenceHash}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step 3: Tool Invocation & Credential Verification */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-indigo-600" />
                  3. Tool Execution &amp; Credential
                </h4>
                <span className="text-2xs font-mono text-slate-500">
                  Tool Server Boundary
                </span>
              </div>

              {latestIncident.toolCall ? (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                    <div className="text-2xs font-semibold text-slate-700 uppercase mb-1">
                      Proposed Tool Invocation:
                    </div>
                    <div className="font-mono text-xs font-bold text-indigo-700">
                      {latestIncident.toolCall.tool}()
                    </div>
                    <pre className="mt-2 text-2xs text-slate-800 bg-white p-2 rounded border border-slate-200 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {JSON.stringify(latestIncident.toolCall.args, null, 2)}
                    </pre>
                  </div>

                  {latestIncident.toolResult && (
                    <div
                      className={`p-3 rounded-md border text-xs ${
                        latestIncident.toolResult.success
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}
                    >
                      <div className="font-semibold text-2xs uppercase mb-1">
                        Tool Server Result: {latestIncident.toolResult.success ? 'EXECUTED' : 'BLOCKED'}
                      </div>
                      <p className="text-xs">
                        {latestIncident.toolResult.error || JSON.stringify(latestIncident.toolResult.data)}
                      </p>
                      <div className="mt-2 pt-2 border-t border-slate-200/50 text-2xs font-mono">
                        Credential: {latestIncident.toolResult.credentialInfo}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-500 p-4 text-center">
                  Agent responded in conversational text; no sensitive tools invoked.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 shadow-2xs">
          Select a test scenario above and click &ldquo;Execute Scenario&rdquo; to trace the LLM Firewall action gate.
        </div>
      )}
    </div>
  );
};
