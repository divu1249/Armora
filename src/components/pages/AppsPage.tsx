import React, { useState } from 'react';
import {
  Layers,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Save,
} from 'lucide-react';
import { OrgApp, ToolTaxonomy } from '../../../server/types.ts';
import { updateAppConfig } from '../../services/api.ts';

interface AppsPageProps {
  apps: OrgApp[];
  taxonomy: Record<string, ToolTaxonomy>;
  onAppUpdated: (app: OrgApp) => void;
}

export const AppsPage: React.FC<AppsPageProps> = ({ apps, taxonomy, onAppUpdated }) => {
  const [selectedAppId, setSelectedAppId] = useState<string>(apps[0]?.id || 'app_hr');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const activeApp = apps.find((a) => a.id === selectedAppId) || apps[0];

  const handleToggleTool = async (toolName: string) => {
    if (!activeApp) return;
    setSaving(true);
    setSavedNotice(null);

    const isCurrentlyAllowed = activeApp.allowedTools.includes(toolName);
    const updatedAllowedTools = isCurrentlyAllowed
      ? activeApp.allowedTools.filter((t) => t !== toolName)
      : [...activeApp.allowedTools, toolName];

    try {
      const updated = await updateAppConfig(activeApp.id, {
        allowedTools: updatedAllowedTools,
      });
      onAppUpdated(updated);
      setSavedNotice(`Tool "${toolName}" permission successfully ${isCurrentlyAllowed ? 'revoked' : 'granted'} for ${activeApp.name}.`);
      setTimeout(() => setSavedNotice(null), 3000);
    } catch (err) {
      console.error('Failed to toggle tool:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-surface border border-line rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-fg flex items-center gap-2">
              <Layers className="w-4 h-4 text-accent" />
              Apps &amp; AI Agents Inventory
              <span className="text-2xs font-mono text-accent bg-accent-solid border border-accent-solid/40 px-2 py-0.5 rounded">
                [SEEDED: 3 Active Agents]
              </span>
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Configure per-agent access privileges, tool permissions, and scoped execution boundaries.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {apps.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => setSelectedAppId(app.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  app.id === selectedAppId
                    ? 'bg-accent-solid border-accent-solid/40 text-accent font-bold'
                    : 'bg-subtle border-line text-muted hover:text-fg'
                }`}
              >
                {app.name}
              </button>
            ))}
          </div>
        </div>

        {savedNotice && (
          <div className="p-3 bg-ok-solid/10 border border-ok-solid/40 text-ok rounded-lg text-xs flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
            <span>{savedNotice}</span>
          </div>
        )}

        {/* Selected App Stats */}
        {activeApp && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-subtle border border-line rounded-lg text-xs">
            <div>
              <span className="text-muted text-2xs block">Agent Name &amp; Target</span>
              <span className="font-bold text-fg text-sm">{activeApp.name}</span>
              <span className="text-2xs font-mono text-muted block">{activeApp.id}</span>
            </div>
            <div>
              <span className="text-muted text-2xs block">Risk Evaluation</span>
              <span className="font-bold font-mono text-accent text-sm tabular-nums">
                {activeApp.riskScore}/100 Risk Score
              </span>
              <span className="text-2xs font-mono text-warn block">{activeApp.status}</span>
            </div>
            <div>
              <span className="text-muted text-2xs block">Traffic &amp; Enforcements</span>
              <span className="font-bold font-mono text-fg text-sm tabular-nums">
                {activeApp.totalRequests} Invocations
              </span>
              <span className="text-2xs font-mono text-danger block">{activeApp.blockedCount} Blocked</span>
            </div>
            <div>
              <span className="text-muted text-2xs block">Authentication</span>
              <span className="font-mono text-2xs text-fg2 block">Short-lived workload token</span>
              <span className="text-2xs text-muted">Env: {activeApp.environment}</span>
            </div>
          </div>
        )}
      </div>

      {/* Tool Permission Matrix */}
      <div className="bg-surface border border-line rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
          <div>
            <h3 className="text-sm font-semibold text-fg flex items-center gap-2">
              <Sliders className="w-4 h-4 text-accent" />
              Tool Permission Matrix for {activeApp?.name}
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Toggle checkboxes to dynamically restrict or allow specific tools for this AI agent.
            </p>
          </div>
          <span className="text-2xs font-mono text-muted">
            {activeApp?.allowedTools.length} / {Object.keys(taxonomy).length} Tools Authorized
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-subtle border-b border-line text-muted font-semibold">
              <tr>
                <th className="py-3 px-3">Protected Tool</th>
                <th className="py-3 px-3">Reads Private Data</th>
                <th className="py-3 px-3">Writes State</th>
                <th className="py-3 px-3">Irreversible</th>
                <th className="py-3 px-3">Sends External</th>
                <th className="py-3 px-3">Privilege</th>
                <th className="py-3 px-3 text-right">Agent Authorization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-mono">
              {Object.entries(taxonomy).map(([toolName, tax]) => {
                const isAllowed = activeApp?.allowedTools.includes(toolName);
                return (
                  <tr key={toolName} className="hover:bg-subtle transition-colors">
                    <td className="py-3 px-3 font-bold text-fg font-mono">{toolName}</td>
                    <td className="py-3 px-3">
                      {tax.readsPrivateData ? (
                        <span className="text-warn bg-warn-solid border border-warn-solid/40 px-2 py-0.5 rounded text-2xs">
                          YES (Private)
                        </span>
                      ) : (
                        <span className="text-muted">NO</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {tax.writes ? (
                        <span className="text-fg2 bg-raised px-2 py-0.5 rounded text-2xs">
                          YES (Mutating)
                        </span>
                      ) : (
                        <span className="text-muted">NO</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {tax.irreversible ? (
                        <span className="text-danger bg-danger-solid border border-danger-solid/40 px-2 py-0.5 rounded text-2xs">
                          YES (Irreversible)
                        </span>
                      ) : (
                        <span className="text-muted">NO</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {tax.sendsExternal ? (
                        <span className="text-danger bg-danger-solid border border-danger-solid/40 px-2 py-0.5 rounded text-2xs">
                          YES (External)
                        </span>
                      ) : (
                        <span className="text-ok bg-ok-solid border border-ok-solid/40 px-2 py-0.5 rounded text-2xs">
                          NO (Internal)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 uppercase text-2xs text-fg2">{tax.privilege}</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleToggleTool(toolName)}
                        className={`px-3 py-1.5 rounded-lg text-2xs font-bold font-mono transition-colors border ${
                          isAllowed
                            ? 'bg-ok-solid hover:brightness-110 border-ok-solid/40 text-ok'
                            : 'bg-code hover:bg-raised border-line-strong text-code-muted'
                        }`}
                      >
                        {isAllowed ? '✓ AUTHORIZED' : 'RESTRICTED'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
