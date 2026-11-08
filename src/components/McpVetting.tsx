import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Flame,
  RotateCcw,
  AlertTriangle,
  Server,
  Lock,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { fetchMcpTools, simulateMcpRugPull, resetMcpRegistry } from '../services/api.ts';

export const McpVetting: React.FC = () => {
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    setLoading(true);
    try {
      const data = await fetchMcpTools();
      setTools(data.tools);
    } catch (err) {
      console.error('Failed to load MCP tools:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRugPull = async (toolId: string) => {
    setLoading(true);
    try {
      const res = await simulateMcpRugPull(toolId);
      if (res.success) {
        setActionNotice(`Simulated Rug Pull on tool "${res.tool.name}"! Cryptographic integrity hash mismatch detected, prompt injection heuristic flagged the embedded override directive, and the tool was automatically quarantined.`);
        await loadTools();
      }
    } catch (err) {
      console.error('Failed to simulate rug pull:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await resetMcpRegistry();
      setActionNotice('MCP server registry restored. All tool description hashes pinned and verified.');
      await loadTools();
    } catch (err) {
      console.error('Failed to reset MCP registry:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-600" />
              Model Context Protocol (MCP) Tool Vetting &amp; Pinning Registry
              <span className="text-2xs font-mono text-slate-500 font-normal">
                [BUILT: SHA-256 Pinned Schema Integrity]
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Protects AI agents against &ldquo;Tool Rug Pulls&rdquo; where external MCP servers sneak prompt injections into tool description docstrings after initial operator approval.
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleReset}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Registry to Baseline
          </button>
        </div>

        {actionNotice && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-300 text-amber-950 rounded-md text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>{actionNotice}</div>
          </div>
        )}

        <div className="space-y-4">
          {tools.map((t) => {
            const isQuarantined = t.status === 'QUARANTINED';
            const hashMismatch = t.approvedHash !== t.currentHash;

            return (
              <div
                key={t.id}
                className={`p-4 rounded-lg border transition-all ${
                  isQuarantined
                    ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-700">
                      {t.name}()
                    </span>
                    <span className="text-2xs font-mono text-slate-500 font-normal">
                      Server: {t.server}
                    </span>
                    <span
                      className={`text-2xs font-mono font-bold px-1.5 py-0.2 rounded ${
                        isQuarantined
                          ? 'bg-rose-200 text-rose-900'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>

                  {!isQuarantined && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleRugPull(t.id)}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-2xs font-semibold shadow-xs flex items-center gap-1 transition-colors"
                    >
                      <Flame className="w-3 h-3" />
                      Simulate Rug Pull
                    </button>
                  )}
                </div>

                <div className="p-2.5 bg-white rounded border border-slate-200 text-xs text-slate-800 mb-3">
                  <div className="text-3xs font-semibold uppercase text-slate-400 mb-0.5">
                    Tool Description Docstring (Rendered into Agent System Prompt):
                  </div>
                  <div className={isQuarantined ? 'text-rose-900 font-medium' : 'text-slate-700'}>
                    {t.description}
                  </div>
                </div>

                {isQuarantined && t.findings.length > 0 && (
                  <div className="mb-3 p-2.5 bg-rose-100/70 border border-rose-300 rounded text-2xs text-rose-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 uppercase tracking-wide">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-700" />
                      Automated Detection &amp; Quarantine Findings:
                    </div>
                    {t.findings.map((f: string, idx: number) => (
                      <div key={idx} className="font-mono pl-5">
                        • {f}
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-2xs font-mono text-slate-500 pt-2 border-t border-slate-200/60">
                  <div>
                    Approved Hash: <span className="text-slate-700 font-semibold">{t.approvedHash.slice(0, 24)}...</span>
                  </div>
                  <div>
                    Current Hash:{' '}
                    <span className={hashMismatch ? 'text-rose-700 font-bold' : 'text-emerald-700 font-semibold'}>
                      {t.currentHash.slice(0, 24)}... {hashMismatch && '(MISMATCH)'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
