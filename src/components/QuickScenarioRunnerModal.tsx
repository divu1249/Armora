import React, { useState } from 'react';
import { Play, X, ShieldAlert, Cpu, CheckCircle2, AlertTriangle } from 'lucide-react';
import { FirewallMode, Incident, LLMMode } from '../../server/types.ts';
import { useOverlay } from '../ui/overlay.ts';
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
  const overlayRef = useOverlay(isOpen, onClose);
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
      <div ref={overlayRef} role="dialog" aria-modal="true" aria-label="Run an attack scenario" tabIndex={-1} className="bg-surface border border-line rounded-lg max-w-lg w-full p-6 space-y-4 text-xs ">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-accent fill-accent-solid" />
            <h3 className="text-sm font-semibold text-fg uppercase tracking-wider">
              Execute Attack Scenario Simulator
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-accent transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-3xs font-mono font-bold text-muted mb-1 uppercase tracking-wider">
              // Select Target Attack Scenario:
            </label>
            <select
              value={selectedScenarioId}
              onChange={(e) => setSelectedScenarioId(e.target.value)}
              className="w-full bg-canvas border border-line-strong rounded p-2 text-xs font-mono text-fg focus:outline-none focus:border-accent-solid focus:ring-1 focus:ring-accent-solid/40 cursor-pointer"
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            {activeScenario && (
              <p className="text-2xs text-muted font-sans mt-1.5 leading-relaxed">
                {activeScenario.description}
              </p>
            )}
          </div>

          <div>
            <label className="block text-3xs font-mono font-bold text-muted mb-1 uppercase tracking-wider">
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
                        ? 'bg-accent-solid text-on-solid border-accent-solid '
                        : m === 'shadow'
                        ? 'bg-warn-solid text-on-solid border-warn-solid '
                        : 'bg-danger-solid text-on-solid border-danger-solid '
                      : 'bg-surface border-line text-muted hover:text-fg'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-3xs font-mono font-bold text-muted mb-1 uppercase tracking-wider">
              // Agent Model Driver:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLlmMode('mock')}
                className={`py-2 px-2.5 rounded text-xs font-mono font-semibold transition-all border ${
                  llmMode === 'mock'
                    ? 'bg-accent-solid/10 border-accent-solid text-accent '
                    : 'bg-surface border-line text-muted hover:text-fg'
                }`}
              >
                Simulated Fooled Agent <span className="text-3xs font-mono text-ok block mt-0.5">[BUILT]</span>
              </button>
              <button
                type="button"
                onClick={() => setLlmMode('gemini')}
                className={`py-2 px-2.5 rounded text-xs font-mono font-semibold transition-all border ${
                  llmMode === 'gemini'
                    ? 'bg-accent-solid/10 border-accent-solid text-accent '
                    : 'bg-surface border-line text-muted hover:text-fg'
                }`}
              >
                Gemini (configured model) <span className="text-3xs font-mono text-warn block mt-0.5">[PROTOTYPE]</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-danger-solid/10 border border-danger-solid/40 text-danger rounded text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded bg-surface hover:bg-raised text-muted hover:text-fg text-xs font-mono font-semibold border border-line transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleExecute}
            className="px-4 py-1.5 rounded bg-gradient-to-r from-accent-solid to-accent-solid hover:from-accent-solid hover:to-accent-solid text-on-solid text-xs font-mono font-black uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-on-solid" />
            <span>{loading ? 'Evaluating Gate...' : 'Run Scenario'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
