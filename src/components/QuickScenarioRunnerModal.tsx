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
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 text-xs shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-cyan-400 fill-current" />
            <h3 className="text-sm font-bold text-white">Execute Attack Scenario Simulator</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-2xs font-semibold text-slate-400 mb-1 uppercase">
              Select Test Scenario:
            </label>
            <select
              value={selectedScenarioId}
              onChange={(e) => setSelectedScenarioId(e.target.value)}
              className="w-full bg-[#0b1329] border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            {activeScenario && (
              <p className="text-2xs text-slate-400 mt-1 leading-relaxed">
                {activeScenario.description}
              </p>
            )}
          </div>

          <div>
            <label className="block text-2xs font-semibold text-slate-400 mb-1 uppercase">
              Action Gate Enforcement Mode:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['enforce', 'shadow', 'off'] as FirewallMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-colors border ${
                    mode === m
                      ? m === 'enforce'
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                        : m === 'shadow'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-rose-500 text-white border-rose-400'
                      : 'bg-[#0b1329] border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-2xs font-semibold text-slate-400 mb-1 uppercase">
              Agent Model Driver:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLlmMode('mock')}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors border ${
                  llmMode === 'mock'
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                    : 'bg-[#0b1329] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Simulated Fooled Agent <span className="text-2xs font-mono font-normal">[BUILT]</span>
              </button>
              <button
                type="button"
                onClick={() => setLlmMode('gemini')}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors border ${
                  llmMode === 'gemini'
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                    : 'bg-[#0b1329] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Gemini 3.8 Flash <span className="text-2xs font-mono font-normal">[PROTOTYPE]</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleExecute}
            className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-current text-slate-950" />
            <span>{loading ? 'Evaluating Gate...' : 'Run Scenario'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
