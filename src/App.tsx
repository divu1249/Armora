import React, { useEffect, useState } from 'react';
import {
  Activity,
  Radio,
  FileSearch,
  Layers,
  FileCode,
  Clock,
  Link2,
  ShieldCheck,
  Settings,
  Cpu,
  RotateCcw,
  Play,
  Building2,
  ChevronDown,
  Menu,
  X,
  AlertTriangle,
  Info,
  Crosshair,
  Globe,
  TrendingUp,
  AlertOctagon,
  Server,
  Split,
  Sparkles,
  Keyboard,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { FirewallMode, Incident, OrgApp, ToolTaxonomy } from '../server/types.ts';
import { ScenarioDefinition } from '../server/scenarios.ts';
import { OverviewPage } from './components/pages/OverviewPage.tsx';
import { LiveFeedPage } from './components/pages/LiveFeedPage.tsx';
import { IncidentDetailPage } from './components/pages/IncidentDetailPage.tsx';
import { AppsPage } from './components/pages/AppsPage.tsx';
import { PoliciesPage } from './components/pages/PoliciesPage.tsx';
import { ApprovalsPage } from './components/pages/ApprovalsPage.tsx';
import { AuditPage } from './components/pages/AuditPage.tsx';
import { CredentialsPage } from './components/pages/CredentialsPage.tsx';
import { DocsPage } from './components/pages/DocsPage.tsx';
import { CompliancePage } from './components/pages/CompliancePage.tsx';
import { SettingsPage } from './components/pages/SettingsPage.tsx';
import { SelfTestRunner } from './components/SelfTestRunner.tsx';
import { QuickScenarioRunnerModal } from './components/QuickScenarioRunnerModal.tsx';
import { RedTeamRunner } from './components/RedTeamRunner.tsx';
import { AttackIntel } from './components/AttackIntel.tsx';
import { TrafficIntel } from './components/TrafficIntel.tsx';
import { IncidentResponse } from './components/IncidentResponse.tsx';
import { McpVetting } from './components/McpVetting.tsx';
import { SplitScreenPage } from './components/pages/SplitScreenPage.tsx';
import { PitchPage } from './components/pages/PitchPage.tsx';
import { RealVsSimulatedPage } from './components/pages/RealVsSimulatedPage.tsx';
import { DemoTourModal } from './components/DemoTourModal.tsx';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { Tooltip } from './components/Tooltip.tsx';
import { StatusBanner } from './components/StatusBanner.tsx';
import {
  fetchScenarios,
  fetchIncidents,
  fetchApprovals,
  fetchApps,
  fetchPolicy,
  resetSystemState,
} from './services/api.ts';

type PageRoute =
  | 'overview'
  | 'split_screen'
  | 'pitch'
  | 'real_vs_simulated'
  | 'live_feed'
  | 'incident_detail'
  | 'redteam'
  | 'intel'
  | 'traffic'
  | 'response'
  | 'mcp'
  | 'apps'
  | 'policies'
  | 'approvals'
  | 'audit'
  | 'credentials'
  | 'docs'
  | 'compliance'
  | 'settings'
  | 'selftest';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageRoute>('overview');
  const [firewallMode, setFirewallMode] = useState<FirewallMode>('enforce');
  const [selectedAppFilter, setSelectedAppFilter] = useState<string>('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Core data stores
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [apps, setApps] = useState<OrgApp[]>([]);
  const [taxonomy, setTaxonomy] = useState<Record<string, ToolTaxonomy>>({});
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  // Modals
  const [isRunnerModalOpen, setIsRunnerModalOpen] = useState(false);
  const [isDemoTourOpen, setIsDemoTourOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [globalNotice, setGlobalNotice] = useState<string | null>(null);

  // Dynamic Document Title Sync
  useEffect(() => {
    const titleMap: Record<PageRoute, string> = {
      overview: 'Overview Dashboard',
      split_screen: 'Split-Screen Comparison',
      pitch: 'Pitch & Architecture',
      real_vs_simulated: 'What is Real vs Simulated',
      live_feed: 'Live Event Feed',
      incident_detail: 'Incident Forensic Hero',
      redteam: 'Red-Team Runner',
      intel: 'Attack Intelligence',
      traffic: 'Traffic Intelligence',
      response: 'AI Incident Response',
      mcp: 'MCP Tool Vetting',
      apps: 'Apps & Agent Inventory',
      policies: 'Action Gate Policies',
      approvals: 'Approval Queue',
      audit: 'Logs & Audit Chain',
      credentials: 'Credentials (no standing credentials)',
      docs: 'Gateway Docs',
      compliance: 'OWASP Top 10 Compliance',
      settings: 'Tenant Settings',
      selftest: 'Self-Test Suite',
    };
    document.title = `Armora | ${titleMap[currentPage] || 'Security Gateway'}`;
  }, [currentPage]);

  // Two-stroke Keyboard Shortcuts (e.g. 'g' then 'o', 'g' then 's', '?', 'Esc')
  useEffect(() => {
    let lastKeyGTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept typing in inputs or textareas
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const now = Date.now();

      if (e.key === '?') {
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        setIsShortcutsModalOpen(false);
        setIsDemoTourOpen(false);
        setIsRunnerModalOpen(false);
        return;
      }

      if (e.key.toLowerCase() === 'g') {
        lastKeyGTime = now;
        return;
      }

      if (now - lastKeyGTime < 1000) {
        const key = e.key.toLowerCase();
        if (key === 'o') setCurrentPage('overview');
        else if (key === 's') setCurrentPage('split_screen');
        else if (key === 'd') setIsDemoTourOpen(true);
        else if (key === 'p') setCurrentPage('pitch');
        else if (key === 'r') setCurrentPage('redteam');
        else if (key === 'l') setCurrentPage('live_feed');
        else if (key === 'a') setCurrentPage('apps');
        else if (key === 'q') setCurrentPage('approvals');
        else if (key === 'c') setCurrentPage('compliance');
        else if (key === 'm') setCurrentPage('real_vs_simulated');
        lastKeyGTime = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadAllData = async () => {
    try {
      const [incData, appsData, scData, apprvData, policyData] = await Promise.all([
        fetchIncidents(),
        fetchApps(),
        fetchScenarios(),
        fetchApprovals(),
        fetchPolicy(),
      ]);

      setIncidents(incData);
      setApps(appsData);
      setScenarios(scData);
      setPendingApprovalsCount(apprvData.pending.length);
      setTaxonomy(policyData.taxonomy);
      if (incData.length > 0 && !selectedIncidentId) {
        setSelectedIncidentId(incData[0].id);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Real-time SSE stream listener
  useEffect(() => {
    const eventSource = new EventSource('/api/events');
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'RUN_COMPLETE') {
          setIncidents((prev) => [payload.payload, ...prev.filter((i) => i.id !== payload.payload.id)]);
        } else if (payload.type === 'APPROVAL_QUEUED' || payload.type === 'APPROVAL_RESOLVED') {
          fetchApprovals().then((data) => setPendingApprovalsCount(data.pending.length));
        }
      } catch {
        // ignore
      }
    };
    return () => eventSource.close();
  }, []);

  const handleResetDemoData = async () => {
    try {
      const res = await resetSystemState();
      setGlobalNotice(res.message);
      await loadAllData();
      setTimeout(() => setGlobalNotice(null), 4000);
    } catch (err) {
      console.error('Reset failed:', err);
    }
  };

  const handleSelectIncident = (id: string) => {
    setSelectedIncidentId(id);
    setCurrentPage('incident_detail');
  };

  const handleRunComplete = (newIncident: Incident) => {
    setIncidents((prev) => [newIncident, ...prev]);
    setSelectedIncidentId(newIncident.id);
    setCurrentPage('incident_detail');
  };

  const selectedIncident = incidents.find((i) => i.id === selectedIncidentId) || incidents[0];

  return (
    <div className="min-h-screen bg-[#080b12] text-[#e6edf6] flex flex-col font-sans selection:bg-[#00e5ff] selection:text-slate-950 cyber-grid-bg">
      {/* 1. Persistent Top Prototype & Honesty Warning Telemetry Strip */}
      <div className="bg-[#050810] border-b border-[#00e5ff]/20 px-4 py-1 text-2xs flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-[#ffb020] uppercase tracking-wider font-mono bg-[#ffb020]/10 px-1.5 py-0.5 rounded border border-[#ffb020]/30 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ffb020] animate-ping" />
            PROTOTYPE
          </span>
          <span className="text-[#8293aa]/60" aria-hidden="true">//</span>
          <span className="text-[#e6edf6] font-medium tracking-tight">Synthetic data only (fake Aadhaar/PAN, example.com addresses)</span>
          <span className="text-[#8293aa]/60 hidden sm:inline" aria-hidden="true">//</span>
          <span className="text-[#8293aa] hidden sm:inline">Zero external network calls from firewall code</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-2xs">
          <span className="text-[#00f5a0] bg-[#00f5a0]/10 px-1.5 py-0.5 rounded border border-[#00f5a0]/30">[BUILT]</span>
          <span className="text-[#00e5ff] bg-[#00e5ff]/10 px-1.5 py-0.5 rounded border border-[#00e5ff]/30">[SEEDED]</span>
          <span className="text-[#818cf8] bg-[#818cf8]/10 px-1.5 py-0.5 rounded border border-[#818cf8]/30">[PRECOMPUTED]</span>
          <span className="text-[#ffb020] bg-[#ffb020]/10 px-1.5 py-0.5 rounded border border-[#ffb020]/30">[MOCK ENRICHMENT]</span>
          <span className="text-[#8293aa] bg-[#141f33] px-1.5 py-0.5 rounded border border-slate-700">[ROADMAP]</span>
          <span className="text-slate-600">|</span>
          <span className="text-[#00e5ff] font-semibold italic glow-text-cyan hidden lg:inline">
            &ldquo;Reading untrusted content should never authorize a sensitive action.&rdquo;
          </span>
        </div>
      </div>

      {/* 2. Top Bar: Cyberpunk SOC Header & Breadcrumb Hierarchy */}
      <header className="bg-[#090d18]/95 backdrop-blur-md border-b border-[#00e5ff]/15 px-4 sm:px-6 py-2.5 sticky top-0 z-30 shadow-[0_4px_25px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between gap-4">
          {/* Brand & Org / App Switcher */}
          <div className="flex items-center gap-3 sm:gap-6">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-lg bg-[#0e1626] border border-[#00e5ff]/20 text-[#00e5ff]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-[#00e5ff]/10 border border-[#00e5ff]/50 flex items-center justify-center text-[#00e5ff] font-bold font-mono text-base shadow-[0_0_15px_rgba(0,229,255,0.25)] relative cyber-corner-tr">
                <Shield className="w-4 h-4 text-[#00e5ff]" />
              </div>
              <div>
                <span className="text-sm font-bold text-white tracking-wide flex items-center gap-2 font-heading">
                  <span className="text-white">LLM</span>
                  <span className="text-[#00e5ff] glow-text-cyan">FIREWALL</span>
                  <span className="text-2xs font-mono font-medium px-1.5 py-0.2 rounded bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/30 uppercase tracking-widest">
                    SOC v2.4
                  </span>
                </span>
              </div>
            </div>

            {/* Breadcrumb Hierarchy: Organization > Apps */}
            <div className="hidden md:flex items-center gap-2 text-xs border-l border-[#00e5ff]/15 pl-4">
              <div className="flex items-center gap-1.5 text-slate-300 bg-[#0e1626] px-2.5 py-1 rounded border border-[#00e5ff]/20 font-mono text-2xs">
                <Building2 className="w-3.5 h-3.5 text-[#00e5ff]" />
                <span className="font-semibold text-slate-200">ACME CYBERSEC CORP</span>
              </div>

              <span className="text-[#00e5ff]/40 font-mono">&gt;</span>

              {/* App Switcher Dropdown */}
              <div className="relative">
                <select
                  value={selectedAppFilter}
                  onChange={(e) => setSelectedAppFilter(e.target.value)}
                  className="bg-[#0e1626] border border-[#00e5ff]/30 text-[#00e5ff] font-mono rounded px-2.5 py-1 text-2xs focus:outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff]/30 cursor-pointer shadow-[0_0_10px_rgba(0,229,255,0.08)]"
                >
                  <option value="all">ALL PROTECTED AGENTS (3)</option>
                  {apps.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Right Top Controls: Mode Badge, Quick Simulator, Reset Button */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Mode Switcher Badge */}
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-[#8293aa] hidden sm:inline text-2xs uppercase tracking-wider">GATE:</span>
              <div className="flex rounded border border-[#00e5ff]/30 p-0.5 bg-[#050810]">
                {(['enforce', 'shadow', 'off'] as FirewallMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setFirewallMode(m)}
                    className={`px-2.5 py-0.5 text-2xs font-bold font-mono uppercase rounded transition-all duration-150 ${
                      firewallMode === m
                        ? m === 'enforce'
                          ? 'bg-[#00e5ff] text-[#080b12] font-black shadow-[0_0_12px_rgba(0,229,255,0.6)]'
                          : m === 'shadow'
                          ? 'bg-[#ffb020] text-[#080b12] font-black shadow-[0_0_12px_rgba(255,176,32,0.6)]'
                          : 'bg-[#ff365d] text-white font-black shadow-[0_0_12px_rgba(255,54,93,0.6)]'
                        : 'text-[#8293aa] hover:text-white'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Start 3-Minute Guided Demo Button */}
            <button
              type="button"
              onClick={() => setIsDemoTourOpen(true)}
              className="px-3 py-1 bg-gradient-to-r from-[#00e5ff] to-[#00a8ff] hover:from-[#33ecff] hover:to-[#33b8ff] text-[#080b12] text-xs font-black uppercase tracking-wider rounded font-mono shadow-[0_0_16px_rgba(0,229,255,0.4)] transition-all duration-150 flex items-center gap-1.5 active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 fill-[#080b12]" />
              <span className="hidden sm:inline">3-Min Demo</span>
              <span className="sm:hidden">Demo</span>
            </button>

            {/* Quick Attack Simulator Trigger */}
            <button
              type="button"
              onClick={() => setIsRunnerModalOpen(true)}
              className="px-3 py-1 bg-[#0e1626] hover:bg-[#141f33] text-[#00e5ff] text-xs font-mono font-semibold rounded border border-[#00e5ff]/40 shadow-[0_0_10px_rgba(0,229,255,0.15)] transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current text-[#00e5ff]" />
              <span className="hidden sm:inline">Simulate</span>
            </button>

            {/* Global Reset Demo Data Button */}
            <button
              type="button"
              onClick={handleResetDemoData}
              title="Reset in-memory state and audit chain to genesis"
              className="p-1.5 text-[#8293aa] hover:text-white hover:bg-[#141f33] border border-[#00e5ff]/20 rounded transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="text-2xs hidden xl:inline font-mono">Reset</span>
            </button>

            {/* Keyboard Shortcuts (?) Button */}
            <button
              type="button"
              onClick={() => setIsShortcutsModalOpen(true)}
              title="Keyboard Shortcuts (?)"
              className="p-1.5 text-[#8293aa] hover:text-[#00e5ff] hover:bg-[#141f33] border border-[#00e5ff]/20 rounded transition-colors"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Global Notice Toast */}
      {globalNotice && (
        <div className="bg-[#0e1626] border-b border-[#00e5ff]/40 px-4 py-2 text-xs text-[#00e5ff] font-mono flex items-center justify-between shadow-[0_4px_15px_rgba(0,229,255,0.2)]">
          <div className="flex items-center gap-2">
            <span className="text-[#00f5a0] font-bold">[SYS NOTIFICATION]</span>
            <span>{globalNotice}</span>
          </div>
          <button type="button" onClick={() => setGlobalNotice(null)} className="text-[#00e5ff] hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* 3. Main Dashboard Workspace: Left Sidebar + Page Viewport */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <aside
          className={`w-64 bg-[#090d18] border-r border-[#00e5ff]/15 flex flex-col shrink-0 lg:static fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 lg:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0 top-16' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="p-3 border-b border-[#00e5ff]/15 text-2xs font-mono font-semibold text-[#8293aa] uppercase tracking-wider flex items-center justify-between">
            <span>// SOC NAVIGATION CONSOLE</span>
            <span className="w-2 h-2 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]" />
          </div>

          <nav className="p-2.5 space-y-1 flex-1 overflow-y-auto text-xs font-medium">
            <div className="pt-1 pb-1 text-3xs font-mono uppercase tracking-wider text-[#8293aa]/70 px-2.5">
              // 01 · SURVEILLANCE &amp; CORE
            </div>

            <button
              type="button"
              onClick={() => { setCurrentPage('overview'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded transition-all duration-150 ${
                currentPage === 'overview'
                  ? 'bg-[#00e5ff]/10 text-[#00e5ff] font-bold border-l-2 border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                  : 'text-[#8293aa] hover:text-white hover:bg-[#141f33]/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Activity className={`w-4 h-4 ${currentPage === 'overview' ? 'text-[#00e5ff]' : 'text-[#8293aa]'}`} />
                <span>Overview Dashboard</span>
              </div>
              <span className="text-3xs font-mono text-[#00e5ff]">[HUD]</span>
            </button>

            {/* Split-Screen View */}
            <button
              type="button"
              onClick={() => { setCurrentPage('split_screen'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded transition-all duration-150 ${
                currentPage === 'split_screen'
                  ? 'bg-[#00e5ff]/10 text-[#00e5ff] font-bold border-l-2 border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                  : 'text-[#8293aa] hover:text-white hover:bg-[#141f33]/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Split className={`w-4 h-4 ${currentPage === 'split_screen' ? 'text-[#00e5ff]' : 'text-[#8293aa]'}`} />
                <span>Split-Screen View</span>
              </div>
              <span className="text-3xs font-mono text-[#00e5ff] bg-[#00e5ff]/10 px-1 py-0.2 rounded border border-[#00e5ff]/30">
                OFF vs ON
              </span>
            </button>

            {/* Pitch & Architecture */}
            <button
              type="button"
              onClick={() => { setCurrentPage('pitch'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded transition-all duration-150 ${
                currentPage === 'pitch'
                  ? 'bg-[#00e5ff]/10 text-[#00e5ff] font-bold border-l-2 border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                  : 'text-[#8293aa] hover:text-white hover:bg-[#141f33]/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Shield className={`w-4 h-4 ${currentPage === 'pitch' ? 'text-[#00e5ff]' : 'text-[#8293aa]'}`} />
                <span>Pitch &amp; Architecture</span>
              </div>
              <span className="text-3xs font-mono text-[#a855f7] bg-[#a855f7]/10 px-1 py-0.2 rounded border border-[#a855f7]/30">
                THESIS
              </span>
            </button>

            {/* What is Real vs Simulated */}
            <button
              type="button"
              onClick={() => { setCurrentPage('real_vs_simulated'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded transition-all duration-150 ${
                currentPage === 'real_vs_simulated'
                  ? 'bg-[#00e5ff]/10 text-[#00e5ff] font-bold border-l-2 border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                  : 'text-[#8293aa] hover:text-white hover:bg-[#141f33]/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className={`w-4 h-4 ${currentPage === 'real_vs_simulated' ? 'text-[#00e5ff]' : 'text-[#8293aa]'}`} />
                <span>Real vs. Simulated</span>
              </div>
              <span className="text-3xs font-mono text-[#00f5a0] bg-[#00f5a0]/10 px-1 py-0.2 rounded border border-[#00f5a0]/30">
                AUDIT
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('live_feed'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded transition-all duration-150 ${
                currentPage === 'live_feed'
                  ? 'bg-[#00e5ff]/10 text-[#00e5ff] font-bold border-l-2 border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                  : 'text-[#8293aa] hover:text-white hover:bg-[#141f33]/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Radio className={`w-4 h-4 ${currentPage === 'live_feed' ? 'text-[#00e5ff]' : 'text-[#8293aa]'}`} />
                <span>Live Event Feed</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#00e5ff] animate-pulse shadow-[0_0_8px_#00e5ff]" />
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('incident_detail'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded transition-all duration-150 ${
                currentPage === 'incident_detail'
                  ? 'bg-[#00e5ff]/10 text-[#00e5ff] font-bold border-l-2 border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                  : 'text-[#8293aa] hover:text-white hover:bg-[#141f33]/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileSearch className={`w-4 h-4 ${currentPage === 'incident_detail' ? 'text-[#00e5ff]' : 'text-[#8293aa]'}`} />
                <span>Incident Forensic Hero</span>
              </div>
              <span className="text-3xs font-mono text-[#00e5ff]">[HERO]</span>
            </button>

            {/* ADVANCED THREAT SURVEILLANCE & RED-TEAM */}
            <div className="pt-2.5 pb-1 text-3xs font-mono uppercase tracking-wider text-[#8293aa]/70 px-2.5">
              // 02 · THREAT SURVEILLANCE &amp; RED-TEAM
            </div>

            <button
              type="button"
              onClick={() => { setCurrentPage('redteam'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded transition-all duration-150 ${
                currentPage === 'redteam'
                  ? 'bg-[#00e5ff]/10 text-[#00e5ff] font-bold border-l-2 border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                  : 'text-[#8293aa] hover:text-white hover:bg-[#141f33]/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Crosshair className={`w-4 h-4 ${currentPage === 'redteam' ? 'text-[#ff365d]' : 'text-[#8293aa]'}`} />
                <span>Red-Team Runner</span>
              </div>
              <span className="text-3xs font-mono text-[#ff365d] bg-[#ff365d]/10 px-1 py-0.2 rounded border border-[#ff365d]/30">24 ATKS</span>
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('intel'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded transition-all duration-150 ${
                currentPage === 'intel'
                  ? 'bg-[#00e5ff]/10 text-[#00e5ff] font-bold border-l-2 border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                  : 'text-[#8293aa] hover:text-white hover:bg-[#141f33]/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Globe className={`w-4 h-4 ${currentPage === 'intel' ? 'text-[#818cf8]' : 'text-[#8293aa]'}`} />
                <span>Attack Intelligence</span>
              </div>
              <span className="text-3xs font-mono text-[#818cf8]">SIMHASH</span>
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('traffic'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded transition-all duration-150 ${
                currentPage === 'traffic'
                  ? 'bg-[#00e5ff]/10 text-[#00e5ff] font-bold border-l-2 border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                  : 'text-[#8293aa] hover:text-white hover:bg-[#141f33]/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <TrendingUp className={`w-4 h-4 ${currentPage === 'traffic' ? 'text-[#ffb020]' : 'text-[#8293aa]'}`} />
                <span>Traffic Intelligence</span>
              </div>
              <span className="text-3xs font-mono text-[#ffb020]">14-DAY</span>
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('response'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded transition-all duration-150 ${
                currentPage === 'response'
                  ? 'bg-[#00e5ff]/10 text-[#00e5ff] font-bold border-l-2 border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                  : 'text-[#8293aa] hover:text-white hover:bg-[#141f33]/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AlertOctagon className={`w-4 h-4 ${currentPage === 'response' ? 'text-[#ff365d]' : 'text-[#8293aa]'}`} />
                <span>AI Incident Response</span>
              </div>
              <span className="text-3xs font-mono text-[#ff365d]">KILL-SW</span>
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('mcp'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded transition-all duration-150 ${
                currentPage === 'mcp'
                  ? 'bg-[#00e5ff]/10 text-[#00e5ff] font-bold border-l-2 border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                  : 'text-[#8293aa] hover:text-white hover:bg-[#141f33]/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Server className={`w-4 h-4 ${currentPage === 'mcp' ? 'text-[#00f5a0]' : 'text-[#8293aa]'}`} />
                <span>MCP Tool Vetting</span>
              </div>
              <span className="text-3xs font-mono text-[#00f5a0]">PINNED</span>
            </button>

            <div className="pt-2.5 pb-1 text-3xs font-mono uppercase tracking-wider text-[#8293aa]/70 px-2.5">
              // 03 · ACTION GATE &amp; GOVERNANCE
            </div>

            <button
              type="button"
              onClick={() => { setCurrentPage('apps'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded transition-all duration-150 ${
                currentPage === 'apps'
                  ? 'bg-[#00e5ff]/10 text-[#00e5ff] font-bold border-l-2 border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                  : 'text-[#8293aa] hover:text-white hover:bg-[#141f33]/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers className={`w-4 h-4 ${currentPage === 'apps' ? 'text-[#00e5ff]' : 'text-[#8293aa]'}`} />
                <span>Apps &amp; Permissions</span>
              </div>
              <span className="text-2xs font-mono text-[#8293aa]">3</span>
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('policies'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded transition-all duration-150 ${
                currentPage === 'policies'
                  ? 'bg-[#00e5ff]/10 text-[#00e5ff] font-bold border-l-2 border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                  : 'text-[#8293aa] hover:text-white hover:bg-[#141f33]/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileCode className={`w-4 h-4 ${currentPage === 'policies' ? 'text-[#00e5ff]' : 'text-[#8293aa]'}`} />
                <span>Policies &amp; Dry-Run</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('approvals'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded transition-all duration-150 ${
                currentPage === 'approvals'
                  ? 'bg-[#00e5ff]/10 text-[#00e5ff] font-bold border-l-2 border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                  : 'text-[#8293aa] hover:text-white hover:bg-[#141f33]/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock className={`w-4 h-4 ${currentPage === 'approvals' ? 'text-[#ffb020]' : 'text-[#8293aa]'}`} />
                <span>Approval Queue</span>
              </div>
              {pendingApprovalsCount > 0 && (
                <span className="font-mono text-2xs bg-[#ffb020] text-[#080b12] font-black px-1.5 py-0.2 rounded shadow-[0_0_8px_rgba(255,176,32,0.6)]">
                  {pendingApprovalsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('audit'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded transition-all duration-150 ${
                currentPage === 'audit'
                  ? 'bg-[#00e5ff]/10 text-[#00e5ff] font-bold border-l-2 border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                  : 'text-[#8293aa] hover:text-white hover:bg-[#141f33]/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Link2 className={`w-4 h-4 ${currentPage === 'audit' ? 'text-[#00f5a0]' : 'text-[#8293aa]'}`} />
                <span>Logs &amp; Audit Chain</span>
              </div>
              <span className="text-3xs font-mono text-[#00f5a0]">HMAC</span>
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('credentials'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded transition-all duration-150 ${
                currentPage === 'credentials'
                  ? 'bg-[#00e5ff]/10 text-[#00e5ff] font-bold border-l-2 border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                  : 'text-[#8293aa] hover:text-white hover:bg-[#141f33]/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Shield className={`w-4 h-4 ${currentPage === 'credentials' ? 'text-[#00f5a0]' : 'text-[#8293aa]'}`} />
                <span>Credentials</span>
              </div>
              <span className="text-3xs font-mono text-[#00f5a0]">0 standing</span>
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('docs'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded transition-all duration-150 ${
                currentPage === 'docs'
                  ? 'bg-[#00e5ff]/10 text-[#00e5ff] font-bold border-l-2 border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                  : 'text-[#8293aa] hover:text-white hover:bg-[#141f33]/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileSearch className={`w-4 h-4 ${currentPage === 'docs' ? 'text-[#00f5a0]' : 'text-[#8293aa]'}`} />
                <span>Gateway Docs</span>
              </div>
              <span className="text-3xs font-mono text-[#a855f7]">curl</span>
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('compliance'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded transition-all duration-150 ${
                currentPage === 'compliance'
                  ? 'bg-[#00e5ff]/10 text-[#00e5ff] font-bold border-l-2 border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                  : 'text-[#8293aa] hover:text-white hover:bg-[#141f33]/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className={`w-4 h-4 ${currentPage === 'compliance' ? 'text-[#00e5ff]' : 'text-[#8293aa]'}`} />
                <span>OWASP Top 10</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('settings'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded transition-all duration-150 ${
                currentPage === 'settings'
                  ? 'bg-[#00e5ff]/10 text-[#00e5ff] font-bold border-l-2 border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                  : 'text-[#8293aa] hover:text-white hover:bg-[#141f33]/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Settings className={`w-4 h-4 ${currentPage === 'settings' ? 'text-[#00e5ff]' : 'text-[#8293aa]'}`} />
                <span>Tenant Settings</span>
              </div>
            </button>

            <div className="pt-3 border-t border-[#00e5ff]/15 mt-3">
              <button
                type="button"
                onClick={() => { setCurrentPage('selftest'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded transition-all duration-150 ${
                  currentPage === 'selftest'
                    ? 'bg-[#00e5ff]/10 text-[#00e5ff] font-bold border-l-2 border-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                    : 'text-[#8293aa] hover:text-white hover:bg-[#141f33]/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Cpu className={`w-4 h-4 ${currentPage === 'selftest' ? 'text-[#00f5a0]' : 'text-[#8293aa]'}`} />
                  <span>Self-Test Suite</span>
                </div>
                <span className="text-3xs font-mono text-[#00f5a0] bg-[#00f5a0]/10 px-1 py-0.2 rounded border border-[#00f5a0]/30">
                  100% PASS
                </span>
              </button>
            </div>
          </nav>

          {/* Left Sidebar Footer */}
          <div className="p-3 bg-[#050810] border-t border-[#00e5ff]/15 text-2xs text-[#8293aa] font-mono flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span>GATEWAY v1.0.1</span>
              <span className="text-[#00f5a0]">[ONLINE]</span>
            </div>
            <div className="text-3xs text-slate-500">BOUND: LOCAL TOOL ENGINE</div>
          </div>
        </aside>

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#080b12] relative">
          <StatusBanner />
          <div className="max-w-7xl mx-auto space-y-6">
            {currentPage === 'overview' && (
              <OverviewPage
                incidents={incidents}
                apps={apps}
                firewallMode={firewallMode}
                pendingApprovalsCount={pendingApprovalsCount}
                onSelectApp={(appId) => { setSelectedAppFilter(appId); setCurrentPage('apps'); }}
                onNavigateToFeed={() => setCurrentPage('live_feed')}
                onNavigateToIncident={handleSelectIncident}
                onTriggerScenario={() => setIsRunnerModalOpen(true)}
                selectedAppFilter={selectedAppFilter}
              />
            )}

            {currentPage === 'split_screen' && (
              <SplitScreenPage
                scenarios={scenarios}
                onSelectIncident={handleSelectIncident}
              />
            )}

            {currentPage === 'pitch' && <PitchPage />}

            {currentPage === 'real_vs_simulated' && <RealVsSimulatedPage />}

            {currentPage === 'live_feed' && (
              <LiveFeedPage
                incidents={incidents}
                apps={apps}
                onSelectIncident={handleSelectIncident}
                selectedAppFilter={selectedAppFilter}
                onAppFilterChange={setSelectedAppFilter}
                onTriggerScenario={() => setIsRunnerModalOpen(true)}
              />
            )}

            {currentPage === 'incident_detail' && (
              <IncidentDetailPage
                incident={selectedIncident}
                allIncidents={incidents}
                onSelectIncident={setSelectedIncidentId}
                onBack={() => setCurrentPage('live_feed')}
              />
            )}

            {currentPage === 'redteam' && <RedTeamRunner />}

            {currentPage === 'intel' && <AttackIntel />}

            {currentPage === 'traffic' && <TrafficIntel />}

            {currentPage === 'response' && <IncidentResponse />}

            {currentPage === 'mcp' && <McpVetting />}

            {currentPage === 'apps' && (
              <AppsPage
                apps={apps}
                taxonomy={taxonomy}
                onAppUpdated={(updated) => {
                  setApps((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
                }}
              />
            )}

            {currentPage === 'policies' && (
              <PoliciesPage
                firewallMode={firewallMode}
                onFirewallModeChange={setFirewallMode}
              />
            )}

            {currentPage === 'approvals' && (
              <ApprovalsPage
                onApprovalResolved={() => {
                  fetchApprovals().then((data) => setPendingApprovalsCount(data.pending.length));
                }}
              />
            )}

            {currentPage === 'audit' && <AuditPage />}
            {currentPage === 'credentials' && <CredentialsPage />}
            {currentPage === 'docs' && <DocsPage />}

            {currentPage === 'compliance' && <CompliancePage />}

            {currentPage === 'settings' && <SettingsPage />}

            {currentPage === 'selftest' && <SelfTestRunner />}
          </div>
        </main>
      </div>

      {/* Floating / Triggerable Quick Scenario Runner Modal */}
      <QuickScenarioRunnerModal
        isOpen={isRunnerModalOpen}
        onClose={() => setIsRunnerModalOpen(false)}
        scenarios={scenarios}
        currentMode={firewallMode}
        onRunComplete={handleRunComplete}
      />

      {/* 3-Minute Guided Demo Experience Tour */}
      <DemoTourModal
        isOpen={isDemoTourOpen}
        onClose={() => setIsDemoTourOpen(false)}
        scenarios={scenarios}
        onSelectIncident={handleSelectIncident}
      />

      {/* Keyboard Shortcuts (?) Help Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
    </div>
  );
}
