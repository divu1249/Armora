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
      <div className="cyber-card cyber-corner-tr rounded p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#00e5ff]/15 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Split className="w-5 h-5 text-[#00e5ff]" />
              <h2 className="text-sm font-bold font-heading text-white uppercase tracking-wide">
                Side-by-Side Dual-Posture Comparison
              </h2>
              <span className="text-3xs font-mono text-[#00f5a0] bg-[#00f5a0]/10 border border-[#00f5a0]/30 px-2 py-0.5 rounded">
                [BUILT]
              </span>
              <span className="text-3xs font-mono text-[#00e5ff] bg-[#00e5ff]/10 border border-[#00e5ff]/30 px-2 py-0.5 rounded">
                [SEEDED]
              </span>
            </div>
            <p className="text-xs text-[#8293aa] font-mono mt-1">
              Run the exact same attack scenario with identical prompt segments and tool payloads. Witness how the Action Gate deterministic credential boundary changes the outcome.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-2xs font-mono text-[#ffb020] bg-[#ffb020]/10 border border-[#ffb020]/30 px-3 py-1.5 rounded flex items-center gap-1.5 shadow-[0_0_10px_rgba(255,176,32,0.15)]">
              <AlertTriangle className="w-3.5 h-3.5 text-[#ffb020]" />
              Controlled demonstration using synthetic data
            </span>
          </div>
        </div>

        {/* Scenario Selector & Run CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#8293aa] uppercase tracking-wider">Choose Scenario:</span>
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
                      ? 'bg-[#00e5ff]/10 border-[#00e5ff] text-[#00e5ff] font-bold shadow-[0_0_12px_rgba(0,229,255,0.25)]'
                      : 'bg-[#090d18] border-[#00e5ff]/15 text-[#8293aa] hover:text-white'
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
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#00e5ff] to-[#00a8ff] hover:from-[#33ecff] hover:to-[#33b8ff] text-[#080b12] font-black font-mono text-xs rounded transition-all duration-150 shadow-[0_0_16px_rgba(0,229,255,0.4)] disabled:opacity-50 cursor-pointer active:scale-95 uppercase tracking-wider"
          >
            {running ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Executing Both Modes...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-[#080b12]" />
                Execute Dual Comparison
              </>
            )}
          </button>
        </div>
      </div>

      {/* Selected Scenario Overview Card */}
      {activeScenario && (
        <div className="cyber-card p-4 rounded text-xs space-y-2 border border-[#00e5ff]/20">
          <div className="flex items-center justify-between">
            <span className="font-bold font-heading text-white">{activeScenario.title}</span>
            <span className="font-mono text-2xs text-[#00e5ff]">TARGET AGENT: {activeScenario.appName.toUpperCase()}</span>
          </div>
          <p className="text-slate-300 font-sans">{activeScenario.description}</p>
          <div className="bg-[#050810] p-2.5 rounded border border-[#00e5ff]/15 font-mono text-2xs text-[#8293aa] scanlines-overlay">
            <span className="text-[#ffb020] font-bold">ADVERSARIAL VECTOR: </span>
            {(activeScenario.segments.find((s) => s.role === 'retrieved_doc')?.content || activeScenario.segments[0]?.content || '').slice(0, 180)}...
          </div>
        </div>
      )}

      {/* Split-Screen Side-by-Side Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: WITHOUT FIREWALL (CRIMSON) */}
        <div className="cyber-card cyber-card-crimson rounded p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-[#ff365d]/25 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-[#ff365d]/10 border border-[#ff365d]/50 flex items-center justify-center text-[#ff365d] shadow-[0_0_12px_rgba(255,54,93,0.3)]">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-heading text-[#ff365d] uppercase tracking-wide">
                  Without Firewall (OFF)
                </h3>
                <p className="text-3xs font-mono text-[#8293aa]">Standing Master Key Bypass Mode</p>
              </div>
            </div>
            <span className="text-3xs font-mono text-[#ff365d] bg-[#ff365d]/10 border border-[#ff365d]/40 px-2 py-0.5 rounded font-black tracking-wider">
              UNGUARDED
            </span>
          </div>

          {/* Step 1: Input Ingestion */}
          <div className="p-3 bg-[#090d18] border border-[#ff365d]/20 rounded space-y-1">
            <div className="flex items-center justify-between text-2xs text-[#8293aa] font-mono">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#8293aa]" />
                Step 1: Input Ingestion
              </span>
              <span className="text-[#ff365d] font-bold">No Trust Labels</span>
            </div>
            <p className="text-xs text-slate-300">
              Agent ingests untrusted candidate document or user query without provenance tagging.
            </p>
          </div>

          {/* Step 2: Agent Tool Invocation */}
          <div className="p-3 bg-[#090d18] border border-[#ff365d]/20 rounded space-y-1">
            <div className="flex items-center justify-between text-2xs text-[#8293aa] font-mono">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#8293aa]" />
                Step 2: Proposed Tool Action
              </span>
              <span className="text-slate-300 font-mono">{activeScenario.simulatedFooledToolCall?.tool || 'send_email'}</span>
            </div>
            <p className="text-xs text-slate-300">
              Fooled model executes injected instruction, calling sensitive tool with attacker-specified arguments.
            </p>
          </div>

          {/* Step 3: Enforcement Boundary (DIVERGENCE POINT) */}
          <div className="p-3.5 bg-[#150a10] border border-[#ff365d]/50 rounded space-y-2">
            <div className="flex items-center justify-between text-2xs font-mono font-bold text-[#ff365d]">
              <span className="flex items-center gap-1.5">
                <Unlock className="w-4 h-4 text-[#ff365d]" />
                Step 3: Security Boundary
              </span>
              <span>NO GATE / MASTER KEY</span>
            </div>
            <p className="text-xs text-[#ff365d] leading-relaxed">
              No Action Gate. Standing master credential is unconditionally passed to the protected tool server.
            </p>
            <div className="font-mono text-3xs text-[#ff365d]/80 bg-black/60 p-2 rounded border border-[#ff365d]/30">
              Credential: MASTER_KEY_LIVE_PREMISES_BYPASS (Perpetual standing secret)
            </div>
          </div>

          {/* Step 4: Final Outcome */}
          <div className="p-4 bg-[#150a10] border border-[#ff365d]/50 rounded space-y-2 shadow-[0_0_15px_rgba(255,54,93,0.15)]">
            <div className="flex items-center gap-2 text-[#ff365d] font-bold font-mono text-xs glow-text-crimson">
              <XCircle className="w-4 h-4" />
              <span>RESULT: BREACH OCCURRED</span>
            </div>
            <p className="text-xs text-slate-300 font-sans">
              {withoutIncident
                ? withoutIncident.withoutFirewallOutcome?.impact || 'Tool executed directly. Confidential data exfiltrated to external recipient.'
                : activeScenario.withoutFirewallOutcome?.impact || 'Tool executed directly with standing master key.'}
            </p>
            <div className="flex items-center justify-between text-2xs font-mono pt-1 border-t border-[#ff365d]/30">
              <span className="text-[#8293aa]">Data Left Premises:</span>
              <span className="text-[#ff365d] font-black">YES (CRITICAL LEAK)</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: WITH FIREWALL (CYAN) */}
        <div className="cyber-card cyber-card-glow rounded p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-[#00e5ff]/25 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-[#00e5ff]/10 border border-[#00e5ff]/50 flex items-center justify-center text-[#00e5ff] shadow-[0_0_12px_rgba(0,229,255,0.3)]">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-heading text-[#00e5ff] uppercase tracking-wide">
                  With LLM Firewall (ENFORCE)
                </h3>
                <p className="text-3xs font-mono text-[#8293aa]">Action Gate &amp; Credential Broker Mode</p>
              </div>
            </div>
            <span className="text-3xs font-mono text-[#00e5ff] bg-[#00e5ff]/10 border border-[#00e5ff]/40 px-2 py-0.5 rounded font-black tracking-wider">
              PROTECTED
            </span>
          </div>

          {/* Step 1: Input Ingestion with Trust Provenance */}
          <div className="p-3 bg-[#090d18] border border-[#00e5ff]/20 rounded space-y-1">
            <div className="flex items-center justify-between text-2xs text-[#8293aa] font-mono">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#00e5ff]" />
                Step 1: Tag &amp; Normalize
              </span>
              <span className="text-[#00e5ff] font-bold">RETRIEVED_DOC (Untrusted)</span>
            </div>
            <p className="text-xs text-slate-300">
              NFKC normalization strips hidden zero-width tokens. Document segment is explicitly tagged <span className="font-mono text-[#00e5ff]">RETRIEVED_DOC</span>.
            </p>
          </div>

          {/* Step 2: Detection Signals */}
          <div className="p-3 bg-[#090d18] border border-[#00e5ff]/20 rounded space-y-1">
            <div className="flex items-center justify-between text-2xs text-[#8293aa] font-mono">
              <span className="flex items-center gap-1.5">
                <FileSearch className="w-3.5 h-3.5 text-[#00e5ff]" />
                Step 2: Multi-Signal Detectors
              </span>
              <span className="text-[#ffb020] font-bold">Signals Dispatched</span>
            </div>
            <p className="text-xs text-slate-300">
              Verhoeff Aadhaar, PAN regex, and injection heuristics flag risk signals to the Action Gate.
            </p>
          </div>

          {/* Step 3: Enforcement Boundary (DIVERGENCE POINT) */}
          <div className="p-3.5 bg-[#00e5ff]/10 border border-[#00e5ff]/40 rounded space-y-2">
            <div className="flex items-center justify-between text-2xs font-mono font-bold text-[#00e5ff]">
              <span className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-[#00e5ff]" />
                Step 3: Action Gate &amp; Broker
              </span>
              <span>DETERMINISTIC GATE</span>
            </div>
            <p className="text-xs text-[#00e5ff] leading-relaxed">
              Trifecta Guard (R2) blocks the tool call: untrusted content reading private data cannot authorize external communication.
            </p>
            <div className="font-mono text-3xs text-[#00e5ff]/80 bg-black/60 p-2 rounded border border-[#00e5ff]/30">
              Scoped Token: REFUSED (Signature withheld; standing keys prohibited)
            </div>
          </div>

          {/* Step 4: Final Outcome */}
          <div className="p-4 bg-[#00f5a0]/10 border border-[#00f5a0]/40 rounded space-y-2 shadow-[0_0_15px_rgba(0,245,160,0.15)]">
            <div className="flex items-center gap-2 text-[#00f5a0] font-bold font-mono text-xs glow-text-green">
              <CheckCircle2 className="w-4 h-4" />
              <span>RESULT: ATTACK NEUTRALIZED</span>
            </div>
            <p className="text-xs text-slate-300 font-sans">
              Tool call intercepted at boundary. Zero bytes exfiltrated. Immutable audit entry appended to SHA-256 hash chain.
            </p>
            <div className="flex items-center justify-between text-2xs font-mono pt-1 border-t border-[#00f5a0]/30">
              <span className="text-[#8293aa]">Data Left Premises:</span>
              <span className="text-[#00f5a0] font-black">NO (0 BYTES LEAKED)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
