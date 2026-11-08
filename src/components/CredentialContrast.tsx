import React from 'react';
import { KeyRound, ShieldAlert, ShieldCheck, Clock, FileCheck2, RefreshCw } from 'lucide-react';
import { FirewallMode } from '../../server/types.ts';

interface CredentialContrastProps {
  firewallMode: FirewallMode;
}

export const CredentialContrast: React.FC<CredentialContrastProps> = ({ firewallMode }) => {
  const isOff = firewallMode === 'off';

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-600" />
            Credential Architecture Contrast
            <span className="text-2xs font-mono text-slate-500 font-normal">
              [BUILT: Cryptographic Runtime Comparison]
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Legacy agents hold standing master credentials; the LLM Firewall issues micro-scoped 60-second tokens bound to exact arguments.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Active State:</span>
          {isOff ? (
            <span className="font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-md">
              Firewall OFF (Master Key Active)
            </span>
          ) : (
            <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
              Firewall {firewallMode.toUpperCase()} (Scoped Broker Active)
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Standing Master Key */}
        <div
          className={`p-4 rounded-lg border transition-all ${
            isOff
              ? 'bg-rose-50/60 border-rose-300 ring-2 ring-rose-200'
              : 'bg-slate-50 border-slate-200 opacity-75'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-800">
              <ShieldAlert className="w-4 h-4" />
              <span>Standard Vulnerable Agent Pattern</span>
            </div>
            <span className="text-2xs font-mono bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded">
              FIREWALL OFF
            </span>
          </div>

          <p className="text-xs text-slate-700 mb-3">
            Agent process holds a standing database/API master secret in memory. Any prompt injection that hijacks the model can invoke any tool indefinitely.
          </p>

          <div className="space-y-1.5 font-mono text-2xs">
            <div className="flex justify-between py-1 border-b border-rose-200/60">
              <span className="text-slate-500">Credential Type:</span>
              <span className="text-rose-900 font-semibold">Standing Static Master Secret</span>
            </div>
            <div className="flex justify-between py-1 border-b border-rose-200/60">
              <span className="text-slate-500">TTL / Expiry:</span>
              <span className="text-rose-900 font-semibold">Infinite (Never expires)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-rose-200/60">
              <span className="text-slate-500">Argument Binding:</span>
              <span className="text-rose-900 font-semibold">None (Unrestricted arguments)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-rose-200/60">
              <span className="text-slate-500">Replay Protection:</span>
              <span className="text-rose-900 font-semibold">None (Replayable forever)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Verification:</span>
              <span className="text-rose-900 font-semibold">None (Blind tool execution)</span>
            </div>
          </div>
        </div>

        {/* Right: Scoped Broker Token */}
        <div
          className={`p-4 rounded-lg border transition-all ${
            !isOff
              ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-200'
              : 'bg-slate-50 border-slate-200 opacity-75'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
              <ShieldCheck className="w-4 h-4" />
              <span>LLM Firewall Broker Pattern</span>
            </div>
            <span className="text-2xs font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
              FIREWALL ON
            </span>
          </div>

          <p className="text-xs text-slate-700 mb-3">
            Agent has zero standing credentials. Only when the policy engine permits a call does the Credential Broker issue a single-use micro-token.
          </p>

          <div className="space-y-1.5 font-mono text-2xs">
            <div className="flex justify-between py-1 border-b border-emerald-200/60">
              <span className="text-slate-500">Credential Type:</span>
              <span className="text-emerald-900 font-semibold">HMAC-SHA256 Scoped JTI Token</span>
            </div>
            <div className="flex justify-between py-1 border-b border-emerald-200/60">
              <span className="text-slate-500">TTL / Expiry:</span>
              <span className="text-emerald-900 font-semibold">60 Seconds max</span>
            </div>
            <div className="flex justify-between py-1 border-b border-emerald-200/60">
              <span className="text-slate-500">Argument Binding:</span>
              <span className="text-emerald-900 font-semibold">Cryptographically bound (timingSafeEqual)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-emerald-200/60">
              <span className="text-slate-500">Replay Protection:</span>
              <span className="text-emerald-900 font-semibold">Strict (Single-use JTI nonce store)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Verification:</span>
              <span className="text-emerald-900 font-semibold">Tool Server rejects missing/tampered tokens</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
