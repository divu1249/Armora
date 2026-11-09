import React, { useState } from 'react';
import { Play, X, ShieldAlert, Cpu, CheckCircle2, AlertTriangle } from 'lucide-react';
import { FirewallMode, Incident, LLMMode } from '../../server/types.ts';
import { ScenarioDefinition } from '../../server/scenarios.ts';
import { runAgentScenario } from '../services/api.ts';

interface QuickScenarioRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenarios: ScenarioDefinition[];
  currentMode: FirewallMode;
  onRunComplete: (incident: Incident) => void;
}

export const QuickScenarioRunnerModal: React.FC<QuickScenarioRunnerModalProps> = ({
  isOpen,
  onClose,
  scenarios,
  currentMode,
  onRunComplete,
}) => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(
    scenarios[0]?.id || 's1_hr_resume_exfil'
  );
  const [mode, setMode] = useState<FirewallMode>(currentMode);
  const [llmMode, setLlmMode] = useState<LLMMode>('mock');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeScenario = scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0];

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    try {
      const inc = await runAgentScenario({
        scenarioId: selectedScenarioId,
        firewallMode: mode,
        llmMode,
      });
      onRunComplete(inc);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="cyber-card cyber-corner-tr max-w-lg w-full p-6 space-y-4 text-xs rounded border border-[#00e5ff]/35 shadow-[0_0_35px_rgba(0,0,0,0.8)]">
        <div className="flex items-center justify-between border-b border-[#00e5ff]/20 pb-3">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-[#00e5ff] fill-[#00e5ff]" />
            <h3 className="text-sm font-bold font-heading text-white uppercase tracking-wider">
              Execute Attack Scenario Simulator
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8293aa] hover:text-[#00e5ff] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-3xs font-mono font-bold text-[#8293aa] mb-1 uppercase tracking-wider">
              // Select Target Attack Scenario:
            </label>
            <select
              value={selectedScenarioId}
              onChange={(e) => setSelectedScenarioId(e.target.value)}
              className="w-full bg-[#050810] border border-[#00e5ff]/30 rounded p-2 text-xs font-mono text-white focus:outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff]/40 shadow-[0_0_10px_rgba(0,229,255,0.08)] cursor-pointer"
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            {activeScenario && (
              <p className="text-2xs text-[#8293aa] font-sans mt-1.5 leading-relaxed">
                {activeScenario.description}
              </p>
            )}
          </div>

          <div>
            <label className="block text-3xs font-mono font-bold text-[#8293aa] mb-1 uppercase tracking-wider">
              // Action Gate Enforcement Mode:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['enforce', 'shadow', 'off'] as FirewallMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`py-1.5 rounded text-xs font-black font-mono uppercase transition-all border ${
                    mode === m
                      ? m === 'enforce'
                        ? 'bg-[#00e5ff] text-[#080b12] border-[#00e5ff] shadow-[0_0_12px_rgba(0,229,255,0.6)]'
                        : m === 'shadow'
                        ? 'bg-[#ffb020] text-[#080b12] border-[#ffb020] shadow-[0_0_12px_rgba(255,176,32,0.6)]'
                        : 'bg-[#ff365d] text-white border-[#ff365d] shadow-[0_0_12px_rgba(255,54,93,0.6)]'
                      : 'bg-[#090d18] border-[#00e5ff]/15 text-[#8293aa] hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-3xs font-mono font-bold text-[#8293aa] mb-1 uppercase tracking-wider">
              // Agent Model Driver:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLlmMode('mock')}
                className={`py-2 px-2.5 rounded text-xs font-mono font-semibold transition-all border ${
                  llmMode === 'mock'
                    ? 'bg-[#00e5ff]/10 border-[#00e5ff] text-[#00e5ff] shadow-[0_0_10px_rgba(0,229,255,0.2)]'
                    : 'bg-[#090d18] border-[#00e5ff]/15 text-[#8293aa] hover:text-white'
                }`}
              >
                Simulated Fooled Agent <span className="text-3xs font-mono text-[#00f5a0] block mt-0.5">[BUILT]</span>
              </button>
              <button
                type="button"
                onClick={() => setLlmMode('gemini')}
                className={`py-2 px-2.5 rounded text-xs font-mono font-semibold transition-all border ${
                  llmMode === 'gemini'
                    ? 'bg-[#00e5ff]/10 border-[#00e5ff] text-[#00e5ff] shadow-[0_0_10px_rgba(0,229,255,0.2)]'
                    : 'bg-[#090d18] border-[#00e5ff]/15 text-[#8293aa] hover:text-white'
                }`}
              >
                Gemini (configured model) <span className="text-3xs font-mono text-[#ffb020] block mt-0.5">[PROTOTYPE]</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-[#150a10] border border-[#ff365d]/50 text-[#ff365d] rounded text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-[#00e5ff]/15">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded bg-[#090d18] hover:bg-[#141f33] text-[#8293aa] hover:text-white text-xs font-mono font-semibold border border-[#00e5ff]/15 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleExecute}
            className="px-4 py-1.5 rounded bg-gradient-to-r from-[#00e5ff] to-[#00a8ff] hover:from-[#33ecff] hover:to-[#33b8ff] text-[#080b12] text-xs font-mono font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,229,255,0.4)] active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-[#080b12]" />
            <span>{loading ? 'Evaluating Gate...' : 'Run Scenario'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
