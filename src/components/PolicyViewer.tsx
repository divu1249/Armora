import React, { useEffect, useState } from 'react';
import { FileCode, Save, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { ToolTaxonomy } from '../../server/types.ts';
import { fetchPolicy, updatePolicy } from '../services/api.ts';

export const PolicyViewer: React.FC = () => {
  const [yamlContent, setYamlContent] = useState<string>('');
  const [taxonomy, setTaxonomy] = useState<Record<string, ToolTaxonomy>>({});
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);

  const loadPolicy = async () => {
    try {
      const data = await fetchPolicy();
      setYamlContent(data.policyYaml);
      setTaxonomy(data.taxonomy);
    } catch (err) {
      console.error('Failed to load policy:', err);
    }
  };

  useEffect(() => {
    loadPolicy();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setSaveStatus(null);
    try {
      await updatePolicy(yamlContent);
      setSaveStatus({ success: true, message: 'Policy successfully validated and reloaded in Action Gate runtime.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveStatus({ success: false, message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tool Taxonomy Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">
          <Layers className="w-4 h-4 text-indigo-600" />
          Protected Tool Taxonomy &amp; Security Attributes
          <span className="text-2xs font-mono text-slate-500 font-normal">
            [BUILT: Internal Privilege Matrix]
          </span>
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          The Action Gate evaluates these deterministic tool classifications when executing rules R1–R6 and the Trifecta Guard.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Tool Name</th>
                <th className="py-2.5 px-3">Reads Private Data</th>
                <th className="py-2.5 px-3">Writes State</th>
                <th className="py-2.5 px-3">Irreversible</th>
                <th className="py-2.5 px-3">Sends External</th>
                <th className="py-2.5 px-3">Privilege Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {Object.entries(taxonomy).map(([toolName, tax]) => (
                <tr key={toolName} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-bold text-indigo-700">{toolName}</td>
                  <td className="py-2.5 px-3">
                    {tax.readsPrivateData ? (
                      <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-2xs font-semibold">
                        YES (Confidential)
                      </span>
                    ) : (
                      <span className="text-slate-400">NO</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {tax.writes ? (
                      <span className="text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-2xs font-semibold">
                        YES (Mutating)
                      </span>
                    ) : (
                      <span className="text-slate-400">NO (Read-only)</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {tax.irreversible ? (
                      <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-2xs font-semibold">
                        YES (Irreversible)
                      </span>
                    ) : (
                      <span className="text-slate-400">NO</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {tax.sendsExternal ? (
                      <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-2xs font-semibold">
                        YES (External Outbox)
                      </span>
                    ) : (
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-2xs font-semibold">
                        NO (Internal Boundary)
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 uppercase text-2xs font-bold text-slate-700">
                    {tax.privilege}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* YAML Editor Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-indigo-600" />
              Active Action Gate YAML Policy
              <span className="text-2xs font-mono text-slate-500 font-normal">
                [BUILT: js-yaml Schema Validated]
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Edit thresholds, recipient allowlists, and rule activations in real time.
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleSave}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Save className="w-3.5 h-3.5" />
            Validate &amp; Save Policy
          </button>
        </div>

        {saveStatus && (
          <div
            className={`p-3 rounded-md text-xs mb-4 flex items-center gap-2 ${
              saveStatus.success
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}
          >
            {saveStatus.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{saveStatus.message}</span>
          </div>
        )}

        <textarea
          value={yamlContent}
          onChange={(e) => setYamlContent(e.target.value)}
          rows={18}
          className="w-full font-mono text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          spellCheck={false}
        />
      </div>
    </div>
  );
};
