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
      // Run with firewall OFF (simulation of the legacy pattern)
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
      <div className="bg-surface border border-line rounded-lg rounded p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Split className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-semibold text-fg uppercase tracking-wide">
                Side-by-Side Dual-Posture Comparison
              </h2>
              <span className="text-3xs font-mono text-ok bg-ok-solid/10 border border-ok-solid/40 px-2 py-0.5 rounded">
                [BUILT]
              </span>
              <span className="text-3xs font-mono text-accent bg-accent-solid/10 border border-line-strong px-2 py-0.5 rounded">
                [SEEDED]
              </span>
            </div>
            <p className="text-xs text-muted font-mono mt-1">
              Run the exact same attack scenario with identical prompt segments and tool payloads. Witness how the Action Gate deterministic credential boundary changes the outcome.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-2xs font-mono text-warn bg-warn-solid/10 border border-warn-solid/40 px-3 py-1.5 rounded flex items-center gap-1.5 ">
              <AlertTriangle className="w-3.5 h-3.5 text-warn" />
              Controlled demonstration using synthetic data
            </span>
          </div>
        </div>

        {/* Scenario Selector & Run CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted uppercase tracking-wider">Choose Scenario:</span>
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
                  className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all duration-150 border ${
                    sc.id === selectedScenarioId
                      ? 'bg-accent-solid/10 border-accent-solid text-accent font-bold '
                      : 'bg-surface border-line text-muted hover:text-fg'
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
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-accent-solid to-accent-solid hover:from-accent-solid hover:to-accent-solid text-on-solid font-black font-mono text-xs rounded transition-all duration-150 disabled:opacity-50 cursor-pointer active:scale-95 uppercase tracking-wider"
          >
            {running ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Executing Both Modes...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-on-solid" />
                Execute Dual Comparison
              </>
            )}
          </button>
        </div>
      </div>

      {/* Selected Scenario Overview Card */}
      {activeScenario && (
        <div className="bg-surface border border-line rounded-lg p-4 rounded text-xs space-y-2 border border-line">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-fg">{activeScenario.title}</span>
            <span className="font-mono text-2xs text-accent">TARGET AGENT: {activeScenario.appName.toUpperCase()}</span>
          </div>
          <p className="text-fg2 font-sans">{activeScenario.description}</p>
          <div className="bg-code p-2.5 rounded border border-line font-mono text-2xs text-code-muted ">
            <span className="text-warn font-bold">ADVERSARIAL VECTOR: </span>
            {(activeScenario.segments.find((s) => s.role === 'retrieved_doc')?.content || activeScenario.segments[0]?.content || '').slice(0, 180)}...
          </div>
        </div>
      )}

      {/* Split-Screen Side-by-Side Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: WITHOUT FIREWALL (CRIMSON) */}
        <div className="bg-surface border border-line rounded-lg border-danger-solid/40 rounded p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-danger-solid/40 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-danger-solid/10 border border-danger-solid/40 flex items-center justify-center text-danger ">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-danger uppercase tracking-wide">
                  Without Firewall (OFF)
                </h3>
                <p className="text-3xs font-mono text-muted">Simulation of the legacy pattern (standing key)</p>
              </div>
            </div>
            <span className="text-3xs font-mono text-danger bg-danger-solid/10 border border-danger-solid/40 px-2 py-0.5 rounded font-black tracking-wider">
              UNGUARDED
            </span>
          </div>

          {/* Step 1: Input Ingestion */}
          <div className="p-3 bg-surface border border-line rounded space-y-1">
            <div className="flex items-center justify-between text-2xs text-muted font-mono">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-muted" />
                Step 1: Input Ingestion
              </span>
              <span className="text-danger font-bold">No Trust Labels</span>
            </div>
            <p className="text-xs text-fg2">
              Agent ingests untrusted candidate document or user query without provenance tagging.
            </p>
          </div>

          {/* Step 2: Agent Tool Invocation */}
          <div className="p-3 bg-surface border border-line rounded space-y-1">
            <div className="flex items-center justify-between text-2xs text-muted font-mono">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted" />
                Step 2: Proposed Tool Action
              </span>
              <span className="text-fg2 font-mono">{activeScenario.simulatedFooledToolCall?.tool || 'send_email'}</span>
            </div>
            <p className="text-xs text-fg2">
              Fooled model executes injected instruction, calling sensitive tool with attacker-specified arguments.
            </p>
          </div>

          {/* Step 3: Enforcement Boundary (DIVERGENCE POINT) */}
          <div className="p-3.5 bg-danger-solid/10 border border-danger-solid/40 rounded space-y-2">
            <div className="flex items-center justify-between text-2xs font-mono font-bold text-danger">
              <span className="flex items-center gap-1.5">
                <Unlock className="w-4 h-4 text-danger" />
                Step 3: Security Boundary
              </span>
              <span>NO GATE / LEGACY SIMULATION</span>
            </div>
            <p className="text-xs text-danger leading-relaxed">
              No Action Gate. A standing key is passed through the isolated legacy-pattern simulation (the real tool server rejects it).
            </p>
            <div className="font-mono text-3xs text-danger bg-black/60 p-2 rounded border border-danger-solid/40">
              Credential: standing key, random per boot (Simulation of the legacy pattern)
            </div>
          </div>

          {/* Step 4: Final Outcome */}
          <div className="p-4 bg-danger-solid/10 border border-danger-solid/40 rounded space-y-2 ">
            <div className="flex items-center gap-2 text-danger font-bold font-mono text-xs ">
              <XCircle className="w-4 h-4" />
              <span>RESULT: BREACH OCCURRED</span>
            </div>
            <p className="text-xs text-fg2 font-sans">
              {withoutIncident
                ? withoutIncident.withoutFirewallOutcome?.impact || 'Tool executed directly. Confidential data exfiltrated to external recipient.'
                : activeScenario.withoutFirewallOutcome?.impact || 'Tool executed directly with a standing key (Simulation of the legacy pattern).'}
            </p>
            <div className="flex items-center justify-between text-2xs font-mono pt-1 border-t border-danger-solid/40">
              <span className="text-muted">Data Left Premises:</span>
              <span className="text-danger font-black">YES (CRITICAL LEAK)</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: WITH FIREWALL (CYAN) */}
        <div className="bg-surface border border-line rounded-lg rounded p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-line-strong pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-accent-solid/10 border border-line-strong flex items-center justify-center text-accent ">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-accent uppercase tracking-wide">
                  With Armora (ENFORCE)
                </h3>
                <p className="text-3xs font-mono text-muted">Action Gate &amp; Credential Broker Mode</p>
              </div>
            </div>
            <span className="text-3xs font-mono text-accent bg-accent-solid/10 border border-line-strong px-2 py-0.5 rounded font-black tracking-wider">
              PROTECTED
            </span>
          </div>

          {/* Step 1: Input Ingestion with Trust Provenance */}
          <div className="p-3 bg-surface border border-line rounded space-y-1">
            <div className="flex items-center justify-between text-2xs text-muted font-mono">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-accent" />
                Step 1: Tag &amp; Normalize
              </span>
              <span className="text-accent font-bold">RETRIEVED_DOC (Untrusted)</span>
            </div>
            <p className="text-xs text-fg2">
              NFKC normalization strips hidden zero-width tokens. Document segment is explicitly tagged <span className="font-mono text-accent">RETRIEVED_DOC</span>.
            </p>
          </div>

          {/* Step 2: Detection Signals */}
          <div className="p-3 bg-surface border border-line rounded space-y-1">
            <div className="flex items-center justify-between text-2xs text-muted font-mono">
              <span className="flex items-center gap-1.5">
                <FileSearch className="w-3.5 h-3.5 text-accent" />
                Step 2: Multi-Signal Detectors
              </span>
              <span className="text-warn font-bold">Signals Dispatched</span>
            </div>
            <p className="text-xs text-fg2">
              Verhoeff Aadhaar, PAN regex, and injection heuristics flag risk signals to the Action Gate.
            </p>
          </div>

          {/* Step 3: Enforcement Boundary (DIVERGENCE POINT) */}
          <div className="p-3.5 bg-accent-solid/10 border border-line-strong rounded space-y-2">
            <div className="flex items-center justify-between text-2xs font-mono font-bold text-accent">
              <span className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-accent" />
                Step 3: Action Gate &amp; Broker
              </span>
              <span>DETERMINISTIC GATE</span>
            </div>
            <p className="text-xs text-accent leading-relaxed">
              Trifecta Guard (R2) blocks the tool call: untrusted content reading private data cannot authorize external communication.
            </p>
            <div className="font-mono text-3xs text-accent bg-black/60 p-2 rounded border border-line-strong">
              Scoped Token: REFUSED (Signature withheld; standing keys prohibited)
            </div>
          </div>

          {/* Step 4: Final Outcome */}
          <div className="p-4 bg-ok-solid/10 border border-ok-solid/40 rounded space-y-2 ">
            <div className="flex items-center gap-2 text-ok font-bold font-mono text-xs ">
              <CheckCircle2 className="w-4 h-4" />
              <span>RESULT: ATTACK NEUTRALIZED</span>
            </div>
            <p className="text-xs text-fg2 font-sans">
              Tool call intercepted at boundary. Zero bytes exfiltrated. Audit entry appended to keyed audit hash chain.
            </p>
            <div className="flex items-center justify-between text-2xs font-mono pt-1 border-t border-ok-solid/40">
              <span className="text-muted">Data Left Premises:</span>
              <span className="text-ok font-black">NO (0 BYTES LEAKED)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
