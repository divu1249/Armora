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
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Apps &amp; AI Agents Inventory
              <span className="text-2xs font-mono text-cyan-300 bg-cyan-950 border border-cyan-850 px-2 py-0.5 rounded">
                [SEEDED: 3 Active Agents]
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
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
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold'
                    : 'bg-[#0b1329] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {app.name}
              </button>
            ))}
          </div>
        </div>

        {savedNotice && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-200 rounded-lg text-xs flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{savedNotice}</span>
          </div>
        )}

        {/* Selected App Stats */}
        {activeApp && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-[#0b1329] border border-slate-800 rounded-lg text-xs">
            <div>
              <span className="text-slate-500 text-2xs block">Agent Name &amp; Target</span>
              <span className="font-bold text-white text-sm">{activeApp.name}</span>
              <span className="text-2xs font-mono text-slate-400 block">{activeApp.id}</span>
            </div>
            <div>
              <span className="text-slate-500 text-2xs block">Risk Evaluation</span>
              <span className="font-bold font-mono text-cyan-400 text-sm tabular-nums">
                {activeApp.riskScore}/100 Risk Score
              </span>
              <span className="text-2xs font-mono text-amber-400 block">{activeApp.status}</span>
            </div>
            <div>
              <span className="text-slate-500 text-2xs block">Traffic &amp; Enforcements</span>
              <span className="font-bold font-mono text-slate-200 text-sm tabular-nums">
                {activeApp.totalRequests} Invocations
              </span>
              <span className="text-2xs font-mono text-rose-400 block">{activeApp.blockedCount} Blocked</span>
            </div>
            <div>
              <span className="text-slate-500 text-2xs block">Scoped API Key</span>
              <code className="font-mono text-2xs text-cyan-300 block truncate">
                {activeApp.apiKey}
              </code>
              <span className="text-2xs text-slate-500">Env: {activeApp.environment}</span>
            </div>
          </div>
        )}
      </div>

      {/* Tool Permission Matrix */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              Tool Permission Matrix for {activeApp?.name}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Toggle checkboxes to dynamically restrict or allow specific tools for this AI agent.
            </p>
          </div>
          <span className="text-2xs font-mono text-slate-400">
            {activeApp?.allowedTools.length} / {Object.keys(taxonomy).length} Tools Authorized
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#0b1329] border-b border-slate-800 text-slate-400 font-semibold">
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
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {Object.entries(taxonomy).map(([toolName, tax]) => {
                const isAllowed = activeApp?.allowedTools.includes(toolName);
                return (
                  <tr key={toolName} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3 font-bold text-white font-mono">{toolName}</td>
                    <td className="py-3 px-3">
                      {tax.readsPrivateData ? (
                        <span className="text-amber-400 bg-amber-950 border border-amber-800/60 px-2 py-0.5 rounded text-2xs">
                          YES (Private)
                        </span>
                      ) : (
                        <span className="text-slate-500">NO</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {tax.writes ? (
                        <span className="text-slate-300 bg-slate-800 px-2 py-0.5 rounded text-2xs">
                          YES (Mutating)
                        </span>
                      ) : (
                        <span className="text-slate-500">NO</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {tax.irreversible ? (
                        <span className="text-rose-400 bg-rose-950 border border-rose-800/60 px-2 py-0.5 rounded text-2xs">
                          YES (Irreversible)
                        </span>
                      ) : (
                        <span className="text-slate-500">NO</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {tax.sendsExternal ? (
                        <span className="text-rose-400 bg-rose-950 border border-rose-800/60 px-2 py-0.5 rounded text-2xs">
                          YES (External)
                        </span>
                      ) : (
                        <span className="text-emerald-400 bg-emerald-950 border border-emerald-800/60 px-2 py-0.5 rounded text-2xs">
                          NO (Internal)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 uppercase text-2xs text-slate-300">{tax.privilege}</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleToggleTool(toolName)}
                        className={`px-3 py-1.5 rounded-lg text-2xs font-bold font-mono transition-colors border ${
                          isAllowed
                            ? 'bg-emerald-950 hover:bg-emerald-900 border-emerald-600 text-emerald-300'
                            : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-400'
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
