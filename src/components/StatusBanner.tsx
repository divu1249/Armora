import React, { useEffect, useState } from 'react';
import { AlertTriangle, KeyRound } from 'lucide-react';
import { AppConfigInfo, fetchAppConfig, getAdminToken, setAdminToken } from '../services/api.ts';

/**
 * Shows (1) a Gemini availability banner when Gemini is not usable, so simulated output is never
 * mistaken for model output, and (2) an admin-token field when the server requires one.
 */
export const StatusBanner: React.FC = () => {
  const [cfg, setCfg] = useState<AppConfigInfo | null>(null);
  const [token, setToken] = useState<string>(getAdminToken());

  useEffect(() => {
    fetchAppConfig().then(setCfg).catch(() => setCfg(null));
  }, []);

  if (!cfg) return null;
  const needsToken = cfg.adminTokenRequired;

  return (
    <div className="space-y-2 mb-4">
      {cfg.gemini.banner && (
        <div role="status" className="p-3 bg-[#ffb020]/10 border border-[#ffb020]/40 text-[#ffd27a] rounded text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <strong>Gemini not in use: </strong>
            {cfg.gemini.banner}
          </div>
        </div>
      )}
      {needsToken && (
        <div className="p-3 bg-[#0f172a] border border-slate-700 text-slate-200 rounded text-xs flex flex-wrap items-center gap-2">
          <KeyRound className="w-4 h-4 text-cyan-400" />
          <span>Admin token (required for approvals, policy, reset, app settings, kill switch, blocklist, MCP):</span>
          <input
            type="password"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setAdminToken(e.target.value);
            }}
            placeholder="x-admin-token"
            className="bg-[#080b12] border border-slate-600 rounded px-2 py-1 font-mono text-xs"
            autoComplete="off"
          />
          <span className="text-slate-500">kept in this tab&apos;s sessionStorage only</span>
        </div>
      )}
      {!cfg.demoMode && (
        <div className="text-2xs text-slate-500 font-mono">DEMO_MODE is off: tamper demo and overrideToolCall are disabled.</div>
      )}
    </div>
  );
};
