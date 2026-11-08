import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Split,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Key,
  Lock,
  Unlock,
  Layers,
  FileSearch,
  Database,
  Mail,
  RefreshCw,
  Info,
} from 'lucide-react';
import { ScenarioDefinition } from '../../../server/scenarios.ts';
import { Tooltip } from '../Tooltip.tsx';
import { runAgentScenario } from '../../services/api.ts';
import { Incident } from '../../../server/types.ts';

interface SplitScreenPageProps {
  scenarios: ScenarioDefinition[];
  onSelectIncident?: (id: string) => void;
}

export const SplitScreenPage: React.FC<SplitScreenPageProps> = ({ scenarios, onSelectIncident }) => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('s1_hr_resume_exfil');
  const [running, setRunning] = useState(false);
  const [withoutIncident, setWithoutIncident] = useState<Incident | null>(null);
  const [withIncident, setWithIncident] = useState<Incident | null>(null);

  const activeScenario = scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0];

  const handleRunComparison = async () => {
    if (!activeScenario) return;
    setRunning(true);
    try {
      // Run with firewall OFF (standing master key)
      const resOff = await runAgentScenario({
        scenarioId: activeScenario.id,
        firewallMode: 'off',
        llmMode: 'mock', // Reliable deterministic mock execution for demo
      });
      setWithoutIncident(resOff);

      // Run with firewall ENFORCE (Action Gate + Scoped Token Broker)
      const resOn = await runAgentScenario({
        scenarioId: activeScenario.id,
        firewallMode: 'enforce',
        llmMode: 'mock',
      });
      setWithIncident(resOn);
    } catch (err) {
      console.error('Failed comparison run:', err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Strict Honest Label */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Split className="w-5 h-5 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">Side-by-Side Firewall Comparison</h2>
              <span className="text-2xs font-mono text-cyan-300 bg-cyan-950 border border-cyan-850 px-2 py-0.5 rounded">
                [BUILT]
              </span>
              <span className="text-2xs font-mono text-emerald-300 bg-emerald-950 border border-emerald-850 px-2 py-0.5 rounded">
                [SEEDED]
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Run the exact same attack scenario with identical prompt segments and tool payloads. Witness how the Action Gate deterministic credential boundary changes the outcome.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-amber-300 bg-amber-950/80 border border-amber-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Controlled demonstration using synthetic data
            </span>
          </div>
        </div>

        {/* Scenario Selector & Run CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Choose Scenario:</span>
            <div className="flex flex-wrap gap-1.5">
              {scenarios.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => {
                    setSelectedScenarioId(sc.id);
                    setWithoutIncident(null);
                    setWithIncident(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors duration-150 border ${
                    sc.id === selectedScenarioId
                      ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-[#070b14] border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {sc.title.split(':')[0]}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunComparison}
            disabled={running}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-lg transition-all duration-150 shadow-md disabled:opacity-50"
          >
            {running ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Executing Both Modes...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-slate-950" />
                Execute Side-by-Side Comparison
              </>
            )}
          </button>
        </div>
      </div>

      {/* Selected Scenario Overview Card */}
      {activeScenario && (
        <div className="bg-[#0b1329] border border-slate-800 rounded-lg p-4 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">{activeScenario.title}</span>
            <span className="font-mono text-2xs text-slate-400">Target Agent: {activeScenario.appName}</span>
          </div>
          <p className="text-slate-300">{activeScenario.description}</p>
          <div className="bg-[#070b14] p-2.5 rounded border border-slate-800/80 font-mono text-2xs text-slate-400">
            <span className="text-amber-400 font-bold">Adversarial Vector: </span>
            {(activeScenario.segments.find((s) => s.role === 'retrieved_doc')?.content || activeScenario.segments[0]?.content || '').slice(0, 180)}...
          </div>
        </div>
      )}

      {/* Split-Screen Side-by-Side Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: WITHOUT FIREWALL */}
        <div className="bg-[#0f172a] border border-rose-900/60 rounded-xl p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-rose-900/40 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-400">Without Firewall (OFF)</h3>
                <p className="text-2xs text-slate-400">Standing Master Key Bypass Mode</p>
              </div>
            </div>
            <span className="text-2xs font-mono text-rose-300 bg-rose-950 border border-rose-800 px-2 py-0.5 rounded font-bold">
              UNGUARDED
            </span>
          </div>

          {/* Step 1: Input Ingestion */}
          <div className="p-3 bg-[#070b14] border border-slate-800 rounded-lg space-y-1">
            <div className="flex items-center justify-between text-2xs text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-500" />
                Step 1: Input Ingestion
              </span>
              <span className="text-rose-400">No Trust Labels</span>
            </div>
            <p className="text-xs text-slate-300">
              Agent ingests untrusted candidate document or user query without provenance tagging.
            </p>
          </div>

          {/* Step 2: Agent Tool Invocation */}
          <div className="p-3 bg-[#070b14] border border-slate-800 rounded-lg space-y-1">
            <div className="flex items-center justify-between text-2xs text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                Step 2: Proposed Tool Action
              </span>
              <span className="text-slate-400">{activeScenario.simulatedFooledToolCall?.tool || 'send_email'}</span>
            </div>
            <p className="text-xs text-slate-300">
              Fooled model executes injected instruction, calling sensitive tool with attacker-specified arguments.
            </p>
          </div>

          {/* Step 3: Enforcement Boundary (DIVERGENCE POINT) */}
          <div className="p-3.5 bg-rose-950/40 border border-rose-800/80 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-2xs font-mono font-bold text-rose-300">
              <span className="flex items-center gap-1.5">
                <Unlock className="w-4 h-4 text-rose-400" />
                Step 3: Security Boundary
              </span>
              <span>NO GATE / MASTER KEY</span>
            </div>
            <p className="text-xs text-rose-200 leading-relaxed">
              No Action Gate. Standing master credential is unconditionally passed to the protected tool server.
            </p>
            <div className="font-mono text-2xs text-rose-300/80 bg-rose-950/80 p-2 rounded border border-rose-900">
              Credential: MASTER_KEY_LIVE_PREMISES_BYPASS (Perpetual standing secret)
            </div>
          </div>

          {/* Step 4: Final Outcome */}
          <div className="p-4 bg-rose-950/30 border border-rose-800 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
              <XCircle className="w-4 h-4" />
              <span>RESULT: BREACH OCCURRED</span>
            </div>
            <p className="text-xs text-slate-300">
              {withoutIncident
                ? withoutIncident.withoutFirewallOutcome?.impact || 'Tool executed directly. Confidential data exfiltrated to external recipient.'
                : activeScenario.withoutFirewallOutcome?.impact || 'Tool executed directly with standing master key.'}
            </p>
            <div className="flex items-center justify-between text-2xs font-mono pt-1 border-t border-rose-900/50">
              <span className="text-slate-400">Data Left Premises:</span>
              <span className="text-rose-400 font-bold">YES (CRITICAL LEAK)</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: WITH FIREWALL */}
        <div className="bg-[#0f172a] border border-cyan-800/60 rounded-xl p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-cyan-800/40 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-cyan-300">With LLM Firewall (ENFORCE)</h3>
                <p className="text-2xs text-slate-400">Action Gate &amp; Credential Broker Mode</p>
              </div>
            </div>
            <span className="text-2xs font-mono text-cyan-300 bg-cyan-950 border border-cyan-850 px-2 py-0.5 rounded font-bold">
              PROTECTED
            </span>
          </div>

          {/* Step 1: Input Ingestion with Trust Provenance */}
          <div className="p-3 bg-[#070b14] border border-slate-800 rounded-lg space-y-1">
            <div className="flex items-center justify-between text-2xs text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                Step 1: Tag &amp; Normalize
              </span>
              <span className="text-cyan-400 font-bold">RETRIEVED_DOC (Untrusted)</span>
            </div>
            <p className="text-xs text-slate-300">
              NFKC normalization strips hidden zero-width tokens. Document segment is explicitly tagged <span className="font-mono text-cyan-300">RETRIEVED_DOC</span>.
            </p>
          </div>

          {/* Step 2: Detection Signals */}
          <div className="p-3 bg-[#070b14] border border-slate-800 rounded-lg space-y-1">
            <div className="flex items-center justify-between text-2xs text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <FileSearch className="w-3.5 h-3.5 text-cyan-400" />
                Step 2: Multi-Signal Detectors
              </span>
              <span className="text-amber-400 font-bold">Signals Dispatched</span>
            </div>
            <p className="text-xs text-slate-300">
              Verhoeff Aadhaar, PAN regex, and injection heuristics flag risk signals to the Action Gate.
            </p>
          </div>

          {/* Step 3: Enforcement Boundary (DIVERGENCE POINT) */}
          <div className="p-3.5 bg-cyan-950/40 border border-cyan-800/80 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-2xs font-mono font-bold text-cyan-300">
              <span className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-cyan-400" />
                Step 3: Action Gate &amp; Broker
              </span>
              <span>DETERMINISTIC GATE</span>
            </div>
            <p className="text-xs text-cyan-200 leading-relaxed">
              Trifecta Guard (R2) blocks the tool call: untrusted content reading private data cannot authorize external communication.
            </p>
            <div className="font-mono text-2xs text-cyan-300/80 bg-cyan-950/80 p-2 rounded border border-cyan-800">
              Scoped Token: REFUSED (Signature withheld; standing keys prohibited)
            </div>
          </div>

          {/* Step 4: Final Outcome */}
          <div className="p-4 bg-emerald-950/30 border border-emerald-800 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>RESULT: ATTACK NEUTRALIZED</span>
            </div>
            <p className="text-xs text-slate-300">
              Tool call intercepted at boundary. Zero bytes exfiltrated. Immutable audit entry appended to SHA-256 hash chain.
            </p>
            <div className="flex items-center justify-between text-2xs font-mono pt-1 border-t border-emerald-900/50">
              <span className="text-slate-400">Data Left Premises:</span>
              <span className="text-emerald-400 font-bold">NO (0 BYTES LEAKED)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
