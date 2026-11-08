import React from 'react';
import { Shield, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

export const Banner: React.FC = () => {
  return (
    <header className="border-b border-slate-200 bg-white shadow-xs">
      {/* Top Prototype & Honesty Warning Strip */}
      <div className="bg-slate-900 text-slate-100 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-amber-400 uppercase tracking-wide">Prototype</span>
          <span className="text-slate-400" aria-hidden="true">·</span>
          <span>Synthetic data only (fake Aadhaar/PAN, example.com addresses)</span>
          <span className="text-slate-400" aria-hidden="true">·</span>
          <span className="text-slate-300">No external network calls from firewall code</span>
        </div>
        <div className="flex items-center gap-3 text-2xs">
          <span className="text-emerald-400 font-mono">[BUILT] Operational</span>
          <span className="text-sky-400 font-mono">[PROTOTYPE] Gemini Live</span>
          <span className="text-amber-400 font-mono">[SEEDED] Attack Vectors</span>
          <span className="text-purple-400 font-mono">[ROADMAP] External Anchor</span>
        </div>
      </div>

      {/* Thesis Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100">
                <Shield className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                LLM Firewall
              </h1>
              <span className="text-xs text-slate-500 font-medium ml-1">
                Deterministic Action Gate &amp; Credential Broker
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600 max-w-4xl">
              <strong className="text-slate-900 font-semibold">Security Thesis: </strong>
              &ldquo;Reading untrusted content should never authorize a sensitive action.&rdquo;
              <span className="text-slate-500 ml-1">
                Detectors produce risk signals; the Action Gate is the deterministic boundary for tool calls routed through the gate and verified by the tool server. Never claims 100% protection or attacker identification.
              </span>
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};
