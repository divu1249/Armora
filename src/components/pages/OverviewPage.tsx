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
  Terminal,
  Crosshair,
  Radio,
  Cpu,
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
  const filteredIncidents =
    selectedAppFilter === 'all'
      ? incidents
      : incidents.filter((inc) => inc.appId === selectedAppFilter);

  const totalRequests = filteredIncidents.length;
  const blockedRequests = filteredIncidents.filter(
    (inc) =>
      inc.decision.action === 'deny' ||
      (inc.firewallMode === 'shadow' && inc.decision.shadowWouldBlock)
  ).length;
  const allowedRequests = filteredIncidents.filter(
    (inc) => inc.decision.action === 'allow' && !inc.decision.shadowWouldBlock
  ).length;

  const avgRiskScore =
    totalRequests > 0
      ? Math.round(
          filteredIncidents.reduce((sum, inc) => {
            const val =
              inc.riskLevel === 'HIGH' ? 85 : inc.riskLevel === 'MEDIUM' ? 55 : 20;
            return sum + val;
          }, 0) / totalRequests
        )
      : 24;

  // Grade calculation
  const riskGrade =
    avgRiskScore > 70 ? 'CRITICAL' : avgRiskScore > 40 ? 'B' : 'A';
  const riskGradeColor =
    avgRiskScore > 70
      ? '#ff365d'
      : avgRiskScore > 40
      ? '#ffb020'
      : '#00e5ff';

  // Derive requests over time data (last 7 intervals)
  const timeBuckets: Record<string, { time: string; requests: number; blocked: number }> = {
    '00:00': { time: '00:00', requests: 4, blocked: 1 },
    '04:00': { time: '04:00', requests: 7, blocked: 2 },
    '08:00': { time: '08:00', requests: 18, blocked: 5 },
    '12:00': { time: '12:00', requests: 24, blocked: 8 },
    '16:00': { time: '16:00', requests: 19, blocked: 4 },
    '20:00': { time: '20:00', requests: 14, blocked: 3 },
    Now: { time: 'Now', requests: Math.max(totalRequests, 8), blocked: Math.max(blockedRequests, 2) },
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
      {/* 1. Top Cyberpunk SOC Telemetry Banner */}
      <div className="cyber-card cyber-corner-tr p-4 rounded border border-[#00e5ff]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_4px_25px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded bg-[#00e5ff]/10 border border-[#00e5ff]/40 text-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.25)]">
            <Activity className="w-5 h-5 text-[#00e5ff] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white font-heading tracking-wide uppercase">
                AI Agent Gateway Security Telemetry
              </h2>
              <span className="text-3xs font-mono font-medium px-2 py-0.5 rounded bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/30 tracking-wider">
                [SEEDED + LIVE SURVEILLANCE]
              </span>
            </div>
            <p className="text-xs text-[#8293aa] font-mono mt-0.5">
              Target Scope: Acme CyberSec Corp · Monitoring 3 protected agents · Action Gate evaluating in-flight calls.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onTriggerScenario}
            className="px-4 py-1.5 bg-[#00e5ff] hover:bg-[#33ecff] text-[#080b12] text-xs font-mono font-black uppercase tracking-wider rounded shadow-[0_0_15px_rgba(0,229,255,0.4)] transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-[#080b12]" />
            <span>Fire Attack Sim</span>
          </button>
        </div>
      </div>

      {/* 2. Cyberpunk HUD Hero: Attack Surface Topology + Arc Risk Meter + Live Terminal (Inspired by reference image) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Autonomous Agent Attack Surface Topology */}
        <div className="lg:col-span-4 cyber-card cyber-corner-tr p-4 rounded flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#00e5ff]/15 pb-2.5 mb-2">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-[#00e5ff]" />
              <span className="text-xs font-bold font-heading text-white tracking-wider uppercase">
                Vulnerability Surface
              </span>
            </div>
            <span className="text-3xs font-mono text-[#ff365d] bg-[#ff365d]/10 px-1.5 py-0.5 rounded border border-[#ff365d]/30">
              GATE TARGETS
            </span>
          </div>

          {/* Futuristic SVG Node Topology Graph */}
          <div className="relative h-44 w-full flex items-center justify-center bg-[#050810]/70 rounded border border-[#00e5ff]/10 overflow-hidden my-2">
            <div className="absolute inset-0 cyber-grid-dense opacity-40" />
            <svg className="w-full h-full" viewBox="0 0 320 180">
              <defs>
                <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="glow-crimson" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Connecting laser lines */}
              <line x1="60" y1="90" x2="160" y2="40" stroke="#00e5ff" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="3 3" />
              <line x1="60" y1="90" x2="160" y2="140" stroke="#00e5ff" strokeWidth="1" strokeOpacity="0.4" />
              <line x1="160" y1="40" x2="260" y2="90" stroke="#ff365d" strokeWidth="1.5" strokeOpacity="0.7" />
              <line x1="160" y1="140" x2="260" y2="90" stroke="#00e5ff" strokeWidth="1" strokeOpacity="0.4" />
              <line x1="160" y1="40" x2="160" y2="140" stroke="#00e5ff" strokeWidth="1" strokeOpacity="0.3" strokeDasharray="2 2" />
              <line x1="60" y1="90" x2="110" y2="40" stroke="#00e5ff" strokeWidth="1" strokeOpacity="0.2" />

              {/* Node 1: Untrusted Input / PDF Source */}
              <circle cx="60" cy="90" r="14" fill="#0e1626" stroke="#00e5ff" strokeWidth="1.5" filter="url(#glow-cyan)" />
              <text x="60" y="93" fill="#00e5ff" fontSize="7" textAnchor="middle" fontFamily="monospace">INPUT</text>

              {/* Node 2: Agent LLM Runner */}
              <circle cx="160" cy="40" r="15" fill="#0e1626" stroke="#00e5ff" strokeWidth="1.5" filter="url(#glow-cyan)" />
              <text x="160" y="43" fill="#00e5ff" fontSize="7" textAnchor="middle" fontFamily="monospace">AGENT</text>

              {/* Node 3: Policy Gate Boundary */}
              <circle cx="160" cy="140" r="15" fill="#0e1626" stroke="#00f5a0" strokeWidth="1.5" />
              <text x="160" y="143" fill="#00f5a0" fontSize="7" textAnchor="middle" fontFamily="monospace">GATE</text>

              {/* Node 4: Exfiltration Target (Threat alert) */}
              <circle cx="260" cy="90" r="18" fill="#1f0a14" stroke="#ff365d" strokeWidth="2" filter="url(#glow-crimson)" />
              <circle cx="260" cy="90" r="24" fill="none" stroke="#ff365d" strokeWidth="0.75" strokeDasharray="2 2" opacity="0.6">
                <animateTransform attributeName="transform" type="rotate" from="0 260 90" to="360 260 90" dur="8s" repeatCount="indefinite" />
              </circle>
              <text x="260" y="93" fill="#ff365d" fontSize="7" fontWeight="bold" textAnchor="middle" fontFamily="monospace">EXFIL</text>
            </svg>

            {/* Micro HUD overlays */}
            <div className="absolute top-2 left-2 text-3xs font-mono text-[#00e5ff]/80">
              TRIPWIRE: ACTIVE
            </div>
            <div className="absolute bottom-2 right-2 text-3xs font-mono text-[#ff365d]">
              INTERCEPTED: 100%
            </div>
          </div>

          <div className="pt-2 border-t border-[#00e5ff]/15 flex items-center justify-between text-2xs font-mono text-[#8293aa]">
            <span>TOPOLOGY: MULTI-AGENT</span>
            <span className="text-[#00e5ff]">3 ACTIVE PROBES</span>
          </div>
        </div>

        {/* Center: Cyberpunk Circular Arc HUD Risk Gauge (Direct from reference image) */}
        <div className="lg:col-span-4 cyber-card cyber-corner-tr p-4 rounded flex flex-col items-center justify-between">
          <div className="w-full flex items-center justify-between border-b border-[#00e5ff]/15 pb-2.5 mb-1">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#00e5ff]" />
              <span className="text-xs font-bold font-heading text-white tracking-wider uppercase">
                Threat Posture
              </span>
            </div>
            <span className="text-3xs font-mono text-[#00e5ff] bg-[#00e5ff]/10 px-1.5 py-0.5 rounded border border-[#00e5ff]/30">
              HUD METER
            </span>
          </div>

          {/* Central Circular Arc Gauge */}
          <div className="relative w-44 h-44 flex items-center justify-center my-1">
            <svg className="w-full h-full" viewBox="0 0 160 160">
              {/* Outer faint tech dashed track */}
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="#141f33"
                strokeWidth="2"
                strokeDasharray="4 4"
              />

              {/* Left Electric Cyan Segmented Arc (Healthy containment) */}
              <path
                d="M 30,80 A 50,50 0 0,1 80,30"
                fill="none"
                stroke="#00e5ff"
                strokeWidth="10"
                strokeLinecap="round"
                className="filter drop-shadow-[0_0_8px_#00e5ff]"
              />
              <path
                d="M 80,30 A 50,50 0 0,1 130,80"
                fill="none"
                stroke="#00e5ff"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray="2 4"
                opacity="0.8"
              />

              {/* Right Threat Crimson Segmented Arc (Blocked attacks) */}
              <path
                d="M 130,80 A 50,50 0 0,1 80,130"
                fill="none"
                stroke="#ff365d"
                strokeWidth="10"
                strokeLinecap="round"
                className="filter drop-shadow-[0_0_8px_#ff365d]"
              />
              <path
                d="M 80,130 A 50,50 0 0,1 30,80"
                fill="none"
                stroke="#00f5a0"
                strokeWidth="8"
                strokeLinecap="round"
                opacity="0.9"
              />
            </svg>

            {/* Inner Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-3xs font-mono text-[#8293aa] tracking-widest uppercase">
                RISK VAIR
              </span>
              <span
                className="text-4xl font-extrabold font-heading my-0.5 tracking-tight glow-text-cyan"
                style={{ color: riskGradeColor }}
              >
                {riskGrade}
              </span>
              <span className="text-3xs font-mono text-[#00e5ff]">
                SCORE {avgRiskScore}/100
              </span>
            </div>
          </div>

          {/* Under-Gauge Telemetry Bars */}
          <div className="w-full space-y-1.5 pt-2 border-t border-[#00e5ff]/15">
            <div className="flex items-center justify-between text-2xs font-mono">
              <span className="text-[#8293aa] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#00e5ff] shadow-[0_0_6px_#00e5ff]" />
                ENFORCE CONTAINMENT
              </span>
              <span className="text-[#00e5ff] font-bold">100%</span>
            </div>
            <div className="w-full h-1.5 bg-[#050810] rounded overflow-hidden flex border border-[#00e5ff]/20">
              <div className="h-full bg-[#00e5ff] w-[75%]" />
              <div className="h-full bg-[#ff365d] w-[25%]" />
            </div>
          </div>
        </div>

        {/* Right: Cyberpunk Live SOC Terminal Stream */}
        <div className="lg:col-span-4 cyber-card cyber-corner-tr p-4 rounded flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#00e5ff]/15 pb-2.5 mb-2">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#00e5ff]" />
              <span className="text-xs font-bold font-heading text-white tracking-wider uppercase">
                Terminal Stream
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00f5a0] animate-ping" />
              <span className="text-3xs font-mono text-[#00f5a0]">LIVE</span>
            </div>
          </div>

          {/* Terminal Console View */}
          <div className="bg-[#050810] border border-[#00e5ff]/20 rounded p-3 h-44 overflow-y-auto font-mono text-3xs text-[#8293aa] space-y-1.5 scanlines-overlay">
            <div className="text-[#00e5ff]/70">[0.001s] CORE: GATEWAY_ENGINE_INITIALIZED</div>
            <div className="text-[#00f5a0]">[0.012s] SEED_STORE: LOADED 3 AGENTS &amp; POLICIES</div>
            <div className="text-[#8293aa]">[0.034s] BROKER: SCOPED TOKEN TTL SET (60s)</div>
            {filteredIncidents.slice(0, 4).map((inc, idx) => (
              <div key={inc.id || idx} className="border-t border-[#00e5ff]/10 pt-1">
                <span className="text-slate-500">[{new Date(inc.timestamp).toLocaleTimeString()}]</span>{' '}
                <span className={inc.decision.action === 'deny' ? 'text-[#ff365d] font-bold' : 'text-[#00f5a0] font-bold'}>
                  {inc.decision.action.toUpperCase()}
                </span>{' '}
                <span className="text-slate-300">{inc.appName || 'Agent'}</span>: {inc.decision.ruleId}
              </div>
            ))}
            <div className="text-[#00e5ff] animate-pulse">&gt; ACTION GATE: READY FOR PACKET INGEST_</div>
          </div>

          <div className="pt-2 border-t border-[#00e5ff]/15 flex items-center justify-between text-2xs font-mono text-[#8293aa]">
            <span>PROTOCOL: SSE /api/events</span>
            <span className="text-[#00f5a0]">STREAM: ONLINE</span>
          </div>
        </div>
      </div>

      {/* 3. KPI Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Evaluated Requests */}
        <div className="cyber-card p-4 rounded hover:border-[#00e5ff]/50 transition-all duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-[#8293aa]">Total Invocations</span>
            <span className="p-1.5 rounded bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/20">
              <Layers className="w-4 h-4 text-[#00e5ff]" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-white tabular-nums tracking-tight">
              {totalRequests}
            </span>
            <span className="text-2xs font-mono text-[#00e5ff]">Across sessions</span>
          </div>
          <div className="mt-2 text-2xs font-mono text-[#8293aa] flex items-center justify-between border-t border-[#00e5ff]/10 pt-2">
            <span>Allowed through Gate:</span>
            <span className="text-[#00f5a0] font-bold">{allowedRequests}</span>
          </div>
        </div>

        {/* Blocked by Action Gate */}
        <div className="cyber-card cyber-card-crimson p-4 rounded hover:border-[#ff365d]/50 transition-all duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-[#8293aa]">Blocked Invocations</span>
            <span className="p-1.5 rounded bg-[#ff365d]/10 text-[#ff365d] border border-[#ff365d]/30">
              <ShieldAlert className="w-4 h-4 text-[#ff365d]" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-[#ff365d] tabular-nums tracking-tight glow-text-crimson">
              {blockedRequests}
            </span>
            <span className="text-2xs font-mono text-[#ff365d]/90">
              {totalRequests > 0 ? Math.round((blockedRequests / totalRequests) * 100) : 0}% blocked
            </span>
          </div>
          <div className="mt-2 text-2xs font-mono text-[#8293aa] flex items-center justify-between border-t border-[#ff365d]/20 pt-2">
            <span>Outbound Leak Prevention:</span>
            <span className="text-[#00f5a0] font-bold">100% Contained</span>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="cyber-card p-4 rounded hover:border-[#ffb020]/50 transition-all duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-[#8293aa]">Approvals Pending</span>
            <span className="p-1.5 rounded bg-[#ffb020]/10 text-[#ffb020] border border-[#ffb020]/30">
              <Clock className="w-4 h-4 text-[#ffb020]" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-[#ffb020] tabular-nums tracking-tight">
              {pendingApprovalsCount}
            </span>
            <span className="text-2xs font-mono text-[#ffb020]/90">60s TTL window</span>
          </div>
          <div className="mt-2 text-2xs font-mono text-[#8293aa] flex items-center justify-between border-t border-[#00e5ff]/10 pt-2">
            <span>Human-in-the-Loop:</span>
            <span className="text-slate-200 font-semibold">Active Queue</span>
          </div>
        </div>

        {/* Average Risk Score */}
        <div className="cyber-card p-4 rounded hover:border-[#00e5ff]/50 transition-all duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-[#8293aa]">Average Session Risk</span>
            <span className="p-1.5 rounded bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/20">
              <Activity className="w-4 h-4 text-[#00e5ff]" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-[#00e5ff] tabular-nums tracking-tight glow-text-cyan">
              {avgRiskScore}/100
            </span>
            <span className="text-2xs font-mono text-[#8293aa]">
              {avgRiskScore > 70 ? 'High' : avgRiskScore > 40 ? 'Moderate' : 'Low'}
            </span>
          </div>
          <div className="mt-2 text-2xs font-mono text-[#8293aa] flex items-center justify-between border-t border-[#00e5ff]/10 pt-2">
            <span>Gate Mode:</span>
            <span className="text-[#00e5ff] font-bold uppercase">{firewallMode}</span>
          </div>
        </div>
      </div>

      {/* 4. Two Column Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Requests Over Time */}
        <div className="lg:col-span-7 cyber-card p-5 rounded">
          <div className="flex items-center justify-between mb-4 border-b border-[#00e5ff]/15 pb-3">
            <div>
              <h3 className="text-sm font-bold font-heading text-white tracking-wide uppercase">
                Requests &amp; Blocks Over Time
              </h3>
              <p className="text-xs text-[#8293aa] font-mono mt-0.5">Chronological traffic breakdown across sessions</p>
            </div>
            <div className="flex items-center gap-3 text-2xs font-mono">
              <span className="flex items-center gap-1.5 text-[#00e5ff]">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#00e5ff] inline-block shadow-[0_0_8px_#00e5ff]" /> Requests
              </span>
              <span className="flex items-center gap-1.5 text-[#ff365d]">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#ff365d] inline-block shadow-[0_0_8px_#ff365d]" /> Blocked
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeChartData}>
                <defs>
                  <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00e5ff" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="blockGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff365d" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#ff365d" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#141f33" />
                <XAxis dataKey="time" stroke="#8293aa" fontSize={11} tickLine={false} fontFamily="monospace" />
                <YAxis stroke="#8293aa" fontSize={11} tickLine={false} fontFamily="monospace" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#090d18', borderColor: '#00e5ff33', borderRadius: '4px', color: '#e6edf6', fontFamily: 'monospace' }}
                  itemStyle={{ fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="requests" stroke="#00e5ff" strokeWidth={2} fillOpacity={1} fill="url(#reqGrad)" />
                <Area type="monotone" dataKey="blocked" stroke="#ff365d" strokeWidth={2} fillOpacity={1} fill="url(#blockGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Blocks by Category */}
        <div className="lg:col-span-5 cyber-card p-5 rounded">
          <div className="flex items-center justify-between mb-4 border-b border-[#00e5ff]/15 pb-3">
            <div>
              <h3 className="text-sm font-bold font-heading text-white tracking-wide uppercase">
                Action Gate Blocks by Rule
              </h3>
              <p className="text-xs text-[#8293aa] font-mono mt-0.5">Distribution of security policy enforcements</p>
            </div>
            <span className="text-2xs font-mono text-[#00e5ff] bg-[#00e5ff]/10 px-2 py-0.5 rounded border border-[#00e5ff]/30">
              Total: {blockedRequests}
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#141f33" horizontal={false} />
                <XAxis type="number" stroke="#8293aa" fontSize={11} fontFamily="monospace" />
                <YAxis dataKey="category" type="category" stroke="#8293aa" fontSize={10} width={110} tickLine={false} fontFamily="monospace" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#090d18', borderColor: '#00e5ff33', borderRadius: '4px', color: '#e6edf6', fontFamily: 'monospace' }}
                  itemStyle={{ fontSize: '11px' }}
                />
                <Bar dataKey="blocks" fill="#00e5ff" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Top Protected Apps & Recent Incidents Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Top Apps by Risk */}
        <div className="lg:col-span-6 cyber-card p-5 rounded">
          <div className="flex items-center justify-between mb-4 border-b border-[#00e5ff]/15 pb-3">
            <div>
              <h3 className="text-sm font-bold font-heading text-white tracking-wide uppercase">
                Protected AI Agents
              </h3>
              <p className="text-xs text-[#8293aa] font-mono mt-0.5">Autonomous agents bounded by Action Gate</p>
            </div>
            <span className="text-2xs font-mono text-[#00e5ff]">ORG: ACME CYBERSEC</span>
          </div>

          <div className="space-y-3">
            {apps.map((app) => (
              <div
                key={app.id}
                onClick={() => onSelectApp(app.id)}
                className="p-3.5 bg-[#090d18] border border-[#00e5ff]/15 hover:border-[#00e5ff]/50 hover:bg-[#0e1626] rounded cursor-pointer transition-all duration-150 flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white font-heading">{app.name}</span>
                    <span
                      className={`text-3xs font-mono font-semibold px-2 py-0.5 rounded ${
                        app.status === 'WARNING'
                          ? 'bg-[#ffb020]/10 text-[#ffb020] border border-[#ffb020]/30'
                          : app.status === 'ACTIVE'
                          ? 'bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/30'
                          : 'bg-[#00f5a0]/10 text-[#00f5a0] border border-[#00f5a0]/30'
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>
                  <p className="text-2xs text-[#8293aa] line-clamp-1">{app.description}</p>
                </div>

                <div className="flex items-center gap-4 text-right shrink-0">
                  <div>
                    <div className="text-xs font-bold font-mono text-[#00e5ff] tabular-nums">
                      {app.riskScore}/100
                    </div>
                    <div className="text-3xs font-mono text-[#8293aa]">Risk Score</div>
                  </div>
                  <div className="hidden sm:block">
                    <div className="text-xs font-bold font-mono text-slate-200 tabular-nums">
                      {app.blockedCount}
                    </div>
                    <div className="text-3xs font-mono text-[#8293aa]">Blocked</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Incidents Feed Snippet */}
        <div className="lg:col-span-6 cyber-card p-5 rounded">
          <div className="flex items-center justify-between mb-4 border-b border-[#00e5ff]/15 pb-3">
            <div>
              <h3 className="text-sm font-bold font-heading text-white tracking-wide uppercase">
                Recent Gateway Interceptions
              </h3>
              <p className="text-xs text-[#8293aa] font-mono mt-0.5">Click any entry to inspect hero forensic timeline</p>
            </div>
            <button
              type="button"
              onClick={onNavigateToFeed}
              className="text-xs font-mono font-semibold text-[#00e5ff] hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>[LIVE FEED]</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {filteredIncidents.slice(0, 4).map((inc) => (
              <div
                key={inc.id}
                onClick={() => onNavigateToIncident(inc.id)}
                className="p-3 bg-[#090d18] border border-[#00e5ff]/15 hover:border-[#00e5ff]/50 hover:bg-[#0e1626] rounded cursor-pointer transition-all duration-150 flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-3xs font-mono font-black px-1.5 py-0.5 rounded ${
                        inc.decision.action === 'allow'
                          ? 'bg-[#00f5a0]/10 text-[#00f5a0] border border-[#00f5a0]/30'
                          : inc.decision.action === 'approve'
                          ? 'bg-[#ffb020]/10 text-[#ffb020] border border-[#ffb020]/30'
                          : 'bg-[#ff365d]/10 text-[#ff365d] border border-[#ff365d]/30'
                      }`}
                    >
                      {inc.decision.action.toUpperCase()}
                    </span>
                    <span className="font-semibold text-slate-200">{inc.appName || 'Agent'}</span>
                    {inc.isSeeded && (
                      <span className="text-3xs font-mono text-[#8293aa]">[SEEDED]</span>
                    )}
                  </div>
                  <p className="text-2xs text-[#8293aa] line-clamp-1">{inc.decision.reason}</p>
                </div>

                <div className="text-right shrink-0 font-mono text-2xs text-[#8293aa]">
                  <div>{new Date(inc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="text-[#00e5ff] text-3xs">{inc.decision.ruleId}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
