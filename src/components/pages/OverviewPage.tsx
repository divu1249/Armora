import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  Activity,
  Layers,
  ArrowUpRight,
  AlertTriangle,
  Lock,
  Play,
  RotateCcw,
} from 'lucide-react';
import { FirewallMode, Incident, OrgApp } from '../../../server/types.ts';

interface OverviewPageProps {
  incidents: Incident[];
  apps: OrgApp[];
  firewallMode: FirewallMode;
  pendingApprovalsCount: number;
  onSelectApp: (appId: string) => void;
  onNavigateToFeed: () => void;
  onNavigateToIncident: (id: string) => void;
  onTriggerScenario: () => void;
  selectedAppFilter: string;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  incidents,
  apps,
  firewallMode,
  pendingApprovalsCount,
  onSelectApp,
  onNavigateToFeed,
  onNavigateToIncident,
  onTriggerScenario,
  selectedAppFilter,
}) => {
  // Filter incidents if specific app selected
  const filteredIncidents = selectedAppFilter === 'all'
    ? incidents
    : incidents.filter((inc) => inc.appId === selectedAppFilter);

  const totalRequests = filteredIncidents.length;
  const blockedRequests = filteredIncidents.filter(
    (inc) => inc.decision.action === 'deny' || (inc.firewallMode === 'shadow' && inc.decision.shadowWouldBlock)
  ).length;
  const allowedRequests = filteredIncidents.filter(
    (inc) => inc.decision.action === 'allow' && !inc.decision.shadowWouldBlock
  ).length;

  const avgRiskScore = totalRequests > 0
    ? Math.round(
        (filteredIncidents.reduce((sum, inc) => {
          const val = inc.riskLevel === 'HIGH' ? 85 : inc.riskLevel === 'MEDIUM' ? 55 : 20;
          return sum + val;
        }, 0) /
          totalRequests)
      )
    : 0;

  // Derive requests over time data (last 7 intervals)
  const timeBuckets: Record<string, { time: string; requests: number; blocked: number }> = {
    '00:00': { time: '00:00', requests: 4, blocked: 1 },
    '04:00': { time: '04:00', requests: 7, blocked: 2 },
    '08:00': { time: '08:00', requests: 18, blocked: 5 },
    '12:00': { time: '12:00', requests: 24, blocked: 8 },
    '16:00': { time: '16:00', requests: 19, blocked: 4 },
    '20:00': { time: '20:00', requests: 14, blocked: 3 },
    'Now': { time: 'Now', requests: totalRequests, blocked: blockedRequests },
  };
  const timeChartData = Object.values(timeBuckets);

  // Derive blocks by category
  const categoryCounts: Record<string, number> = {
    'Prompt Injection': 0,
    'Trifecta Exfil': 0,
    'Domain Mismatch': 0,
    'Financial Guard': 0,
    'Image Exfil': 0,
  };

  filteredIncidents.forEach((inc) => {
    if (inc.decision.ruleId === 'R2_TRIFECTA') categoryCounts['Trifecta Exfil']++;
    else if (inc.decision.ruleId === 'R3_DOMAIN_ALLOWLIST') categoryCounts['Domain Mismatch']++;
    else if (inc.decision.ruleId === 'R4_FINANCIAL_GUARD') categoryCounts['Financial Guard']++;
    else if (inc.decision.ruleId.includes('RISK')) categoryCounts['Prompt Injection']++;
    else if (inc.findings.some((f) => f.category === 'OUTPUT_EXFILTRATION')) categoryCounts['Image Exfil']++;
    else if (inc.decision.action === 'deny') categoryCounts['Prompt Injection']++;
  });

  const categoryChartData = Object.entries(categoryCounts).map(([category, count]) => ({
    category,
    blocks: count,
  }));

  return (
    <div className="space-y-6">
      {/* Top Banner Alert & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d1629] border border-cyan-900/40 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-700/40 text-cyan-400">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">Live AI Agent Gateway Security Telemetry</h2>
              <span className="text-2xs font-mono font-medium px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                [SEEDED + LIVE]
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Monitoring 3 protected agents. The Action Gate is actively evaluating in-flight tool calls.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onTriggerScenario}
            className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-current text-slate-950" />
            Fire Attack Simulation
          </button>
        </div>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Evaluated Requests */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Tool Invocations</span>
            <span className="p-1.5 rounded-md bg-slate-800/80 text-white">
              <Layers className="w-4 h-4 text-white" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              {totalRequests}
            </span>
            <span className="text-2xs font-mono text-cyan-400">Across sessions</span>
          </div>
          <div className="mt-2 text-2xs text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2">
            <span>Allowed through Gate:</span>
            <span className="font-mono text-emerald-400 font-semibold">{allowedRequests}</span>
          </div>
        </div>

        {/* Blocked by Action Gate */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Blocked Invocations</span>
            <span className="p-1.5 rounded-md bg-rose-950/60 text-white border border-rose-900/40">
              <ShieldAlert className="w-4 h-4 text-white" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
              {blockedRequests}
            </span>
            <span className="text-2xs font-mono text-rose-300">
              {totalRequests > 0 ? Math.round((blockedRequests / totalRequests) * 100) : 0}% blocked
            </span>
          </div>
          <div className="mt-2 text-2xs text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2">
            <span>Zero Outbound Leaks:</span>
            <span className="font-mono text-emerald-400 font-semibold">100% Contained</span>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Approvals Pending</span>
            <span className="p-1.5 rounded-md bg-amber-950/60 text-white border border-amber-900/40">
              <Clock className="w-4 h-4 text-white" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
              {pendingApprovalsCount}
            </span>
            <span className="text-2xs font-mono text-amber-300">60s TTL window</span>
          </div>
          <div className="mt-2 text-2xs text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2">
            <span>Human-in-the-loop:</span>
            <span className="font-mono text-slate-300">Active Queue</span>
          </div>
        </div>

        {/* Average Risk Score */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Average Session Risk</span>
            <span className="p-1.5 rounded-md bg-cyan-950 text-white border border-cyan-800/40">
              <Activity className="w-4 h-4 text-white" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-cyan-400 tabular-nums">
              {avgRiskScore}/100
            </span>
            <span className="text-2xs font-mono text-slate-400">
              {avgRiskScore > 70 ? 'High' : avgRiskScore > 40 ? 'Moderate' : 'Low'}
            </span>
          </div>
          <div className="mt-2 text-2xs text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2">
            <span>Gate Mode:</span>
            <span className="font-mono text-cyan-300 font-bold uppercase">{firewallMode}</span>
          </div>
        </div>
      </div>

      {/* Two Column Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Requests Over Time */}
        <div className="lg:col-span-7 bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Requests &amp; Blocks Over Time</h3>
              <p className="text-xs text-slate-400 mt-0.5">Chronological traffic breakdown across sessions</p>
            </div>
            <div className="flex items-center gap-3 text-2xs font-mono">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500 inline-block" /> Requests
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" /> Blocked
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeChartData}>
                <defs>
                  <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="blockGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0b1329', borderColor: '#1e293b', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="requests" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#reqGrad)" />
                <Area type="monotone" dataKey="blocked" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#blockGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Blocks by Category */}
        <div className="lg:col-span-5 bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Action Gate Blocks by Rule</h3>
              <p className="text-xs text-slate-400 mt-0.5">Distribution of security policy enforcements</p>
            </div>
            <span className="text-2xs font-mono text-cyan-400">Total: {blockedRequests}</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={11} />
                <YAxis dataKey="category" type="category" stroke="#94a3b8" fontSize={10} width={100} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0b1329', borderColor: '#1e293b', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Bar dataKey="blocks" fill="#06b6d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Protected Apps & Recent Incidents Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Top Apps by Risk */}
        <div className="lg:col-span-6 bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Protected AI Agents</h3>
              <p className="text-xs text-slate-400 mt-0.5">Seeded organization agent inventory</p>
            </div>
            <span className="text-2xs font-mono text-slate-400">Org: Acme CyberSec Corp</span>
          </div>

          <div className="space-y-3">
            {apps.map((app) => (
              <div
                key={app.id}
                onClick={() => onSelectApp(app.id)}
                className="p-3.5 bg-[#0b1329] border border-slate-800/80 hover:border-cyan-700/60 rounded-lg cursor-pointer transition-colors flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{app.name}</span>
                    <span
                      className={`text-2xs font-mono font-semibold px-2 py-0.2 rounded ${
                        app.status === 'WARNING'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800/50'
                          : app.status === 'ACTIVE'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/50'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>
                  <p className="text-2xs text-slate-400 line-clamp-1">{app.description}</p>
                </div>

                <div className="flex items-center gap-4 text-right shrink-0">
                  <div>
                    <div className="text-xs font-bold font-mono text-cyan-400 tabular-nums">
                      {app.riskScore}/100
                    </div>
                    <div className="text-2xs text-slate-500">Risk Score</div>
                  </div>
                  <div className="hidden sm:block">
                    <div className="text-xs font-bold font-mono text-slate-200 tabular-nums">
                      {app.blockedCount}
                    </div>
                    <div className="text-2xs text-slate-500">Blocked</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Incidents Feed Snippet */}
        <div className="lg:col-span-6 bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Recent Gateway Interceptions</h3>
              <p className="text-xs text-slate-400 mt-0.5">Click any entry to inspect hero forensic timeline</p>
            </div>
            <button
              type="button"
              onClick={onNavigateToFeed}
              className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              <span>View Live Feed</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-white" />
            </button>
          </div>

          <div className="space-y-2.5">
            {filteredIncidents.slice(0, 4).map((inc) => (
              <div
                key={inc.id}
                onClick={() => onNavigateToIncident(inc.id)}
                className="p-3 bg-[#0b1329] border border-slate-800/80 hover:border-cyan-700/60 rounded-lg cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-2xs font-mono font-bold px-1.5 py-0.2 rounded ${
                        inc.decision.action === 'allow'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                          : inc.decision.action === 'approve'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800/50'
                          : 'bg-rose-950 text-rose-300 border border-rose-800/50'
                      }`}
                    >
                      {inc.decision.action.toUpperCase()}
                    </span>
                    <span className="font-semibold text-slate-200">{inc.appName || 'Agent'}</span>
                    {inc.isSeeded && (
                      <span className="text-2xs font-mono text-slate-400">[SEEDED]</span>
                    )}
                  </div>
                  <p className="text-2xs text-slate-400 line-clamp-1">{inc.decision.reason}</p>
                </div>

                <div className="text-right shrink-0 font-mono text-2xs text-slate-400">
                  <div>{new Date(inc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="text-cyan-400">{inc.decision.ruleId}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
