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
      audit: 'Cryptographic Audit Log',
      compliance: 'OWASP Top 10 Compliance',
      settings: 'Tenant Settings',
      selftest: 'Self-Test Suite',
    };
    document.title = `LLM Firewall | ${titleMap[currentPage] || 'Security Gateway'}`;
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
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* 1. Persistent Top Prototype & Honesty Warning Strip */}
      <div className="bg-[#0b1329] border-b border-slate-800/80 px-4 py-1.5 text-2xs flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-amber-400 uppercase tracking-wider font-mono">[PROTOTYPE]</span>
          <span className="text-slate-500" aria-hidden="true">·</span>
          <span className="text-slate-300 font-medium">Synthetic data only (fake Aadhaar/PAN, example.com addresses)</span>
          <span className="text-slate-500" aria-hidden="true">·</span>
          <span className="text-slate-400">Zero external network calls from firewall code</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-2xs">
          <span className="text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800">[BUILT]</span>
          <span className="text-cyan-400 bg-cyan-950/80 px-1.5 py-0.2 rounded border border-cyan-800">[SEEDED]</span>
          <span className="text-indigo-400 bg-indigo-950/80 px-1.5 py-0.2 rounded border border-indigo-800">[PRECOMPUTED]</span>
          <span className="text-amber-400 bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-800">[MOCK ENRICHMENT]</span>
          <span className="text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded border border-slate-700">[ROADMAP]</span>
          <span className="text-slate-500">|</span>
          <span className="text-cyan-300 font-semibold italic">
            &ldquo;Reading untrusted content should never authorize a sensitive action.&rdquo;
          </span>
        </div>
      </div>

      {/* 2. Top Bar: Organization > Apps > API Keys Switcher */}
      <header className="bg-[#0a0f1d] border-b border-slate-800 px-4 sm:px-6 py-2.5 sticky top-0 z-30 shadow-md">
        <div className="flex items-center justify-between gap-4">
          {/* Brand & Org / App Switcher */}
          <div className="flex items-center gap-3 sm:gap-6">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-lg bg-slate-800 text-slate-300"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold font-mono text-sm">
                🛡
              </div>
              <div>
                <span className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                  LLM Firewall
                  <span className="text-2xs font-mono font-medium px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    B2B SaaS
                  </span>
                </span>
              </div>
            </div>

            {/* Breadcrumb Hierarchy: Organization > Apps */}
            <div className="hidden md:flex items-center gap-2 text-xs border-l border-slate-800 pl-4">
              <div className="flex items-center gap-1.5 text-slate-300 bg-[#0f172a] px-2.5 py-1 rounded-md border border-slate-800">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold">Acme CyberSec Corp</span>
              </div>

              <span className="text-slate-600">/</span>

              {/* App Switcher Dropdown */}
              <div className="relative">
                <select
                  value={selectedAppFilter}
                  onChange={(e) => setSelectedAppFilter(e.target.value)}
                  className="bg-[#0f172a] border border-slate-800 text-cyan-300 font-medium rounded-md px-2.5 py-1 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="all">All Protected Apps (3)</option>
                  {apps.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Right Top Controls: Mode Badge, Quick Simulator, Reset Button */}
          <div className="flex items-center gap-3">
            {/* Mode Switcher Badge */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 hidden sm:inline">Gate:</span>
              <div className="flex rounded-md border border-slate-800 p-0.5 bg-[#0b1329]">
                {(['enforce', 'shadow', 'off'] as FirewallMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setFirewallMode(m)}
                    className={`px-2 py-0.5 text-2xs font-bold font-mono uppercase rounded transition-colors ${
                      firewallMode === m
                        ? m === 'enforce'
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : m === 'shadow'
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-rose-500 text-white font-bold'
                        : 'text-slate-400 hover:text-white'
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
              className="px-3 py-1 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 text-xs font-bold rounded-lg shadow-md transition-all duration-150 flex items-center gap-1.5 animate-pulse"
            >
              <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
              <span>Start 3-Min Demo</span>
            </button>

            {/* Quick Attack Simulator Trigger */}
            <button
              type="button"
              onClick={() => setIsRunnerModalOpen(true)}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current text-cyan-400" />
              <span className="hidden sm:inline">Simulate</span>
            </button>

            {/* Global Reset Demo Data Button */}
            <button
              type="button"
              onClick={handleResetDemoData}
              title="Reset in-memory state and audit chain to genesis"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="text-2xs hidden xl:inline">Reset Demo</span>
            </button>

            {/* Keyboard Shortcuts (?) Button */}
            <button
              type="button"
              onClick={() => setIsShortcutsModalOpen(true)}
              title="Keyboard Shortcuts (?)"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Global Notice Toast */}
      {globalNotice && (
        <div className="bg-cyan-950 border-b border-cyan-800 px-4 py-2 text-xs text-cyan-200 flex items-center justify-between">
          <span>{globalNotice}</span>
          <button type="button" onClick={() => setGlobalNotice(null)} className="text-cyan-400 hover:text-white">✕</button>
        </div>
      )}

      {/* 3. Main Dashboard Workspace: Left Sidebar + Page Viewport */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <aside
          className={`w-64 bg-[#0a0f1d] border-r border-slate-800/80 flex flex-col shrink-0 lg:static fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 lg:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0 top-16' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="p-3 border-b border-slate-800/80 text-2xs font-mono font-semibold text-slate-500 uppercase tracking-wider">
            Navigation Console
          </div>

          <nav className="p-3 space-y-1 flex-1 overflow-y-auto text-xs font-medium">
            <button
              type="button"
              onClick={() => { setCurrentPage('overview'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                currentPage === 'overview'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-white" />
                <span>Overview Dashboard</span>
              </div>
            </button>

            {/* Split-Screen View */}
            <button
              type="button"
              onClick={() => { setCurrentPage('split_screen'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                currentPage === 'split_screen'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Split className="w-4 h-4 text-cyan-400" />
                <span>Split-Screen View</span>
              </div>
              <span className="text-2xs font-mono text-cyan-400 bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-800">
                OFF vs ON
              </span>
            </button>

            {/* 3-Minute Demo Trigger */}
            <button
              type="button"
              onClick={() => { setIsDemoTourOpen(true); setMobileMenuOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-amber-300 hover:text-amber-200 hover:bg-amber-950/40 border border-amber-900/40"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Start 3-Min Demo</span>
              </div>
              <span className="text-2xs font-mono text-amber-400 bg-amber-950 px-1.5 py-0.2 rounded">
                Guided
              </span>
            </button>

            {/* Pitch & Architecture */}
            <button
              type="button"
              onClick={() => { setCurrentPage('pitch'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                currentPage === 'pitch'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-purple-400" />
                <span>Pitch &amp; Architecture</span>
              </div>
              <span className="text-2xs font-mono text-purple-400 bg-purple-950 px-1.5 py-0.2 rounded border border-purple-800">
                Thesis
              </span>
            </button>

            {/* What is Real vs Simulated */}
            <button
              type="button"
              onClick={() => { setCurrentPage('real_vs_simulated'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                currentPage === 'real_vs_simulated'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Real vs. Simulated</span>
              </div>
              <span className="text-2xs font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-800">
                Audit
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('live_feed'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                currentPage === 'live_feed'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Radio className="w-4 h-4 text-white" />
                <span>Live Event Feed</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('incident_detail'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                currentPage === 'incident_detail'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileSearch className="w-4 h-4 text-white" />
                <span>Incident Forensic Hero</span>
              </div>
              <span className="text-2xs font-mono text-cyan-400">Hero</span>
            </button>

            {/* NEW ENTERPRISE CYBERSECURITY MODULES */}
            <div className="pt-2 pb-1 text-3xs font-mono uppercase tracking-wider text-slate-500 px-3">
              Advanced Security Ops
            </div>

            <button
              type="button"
              onClick={() => { setCurrentPage('redteam'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                currentPage === 'redteam'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Crosshair className="w-4 h-4 text-white" />
                <span>Red-Team Runner</span>
              </div>
              <span className="text-2xs font-mono text-rose-400">24 Atks</span>
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('intel'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                currentPage === 'intel'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-white" />
                <span>Attack Intelligence</span>
              </div>
              <span className="text-2xs font-mono text-indigo-400">SimHash</span>
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('traffic'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                currentPage === 'traffic'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-4 h-4 text-white" />
                <span>Traffic Intelligence</span>
              </div>
              <span className="text-2xs font-mono text-amber-400">14-Day</span>
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('response'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                currentPage === 'response'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AlertOctagon className="w-4 h-4 text-white" />
                <span>AI Incident Response</span>
              </div>
              <span className="text-2xs font-mono text-rose-400">Kill-Sw</span>
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('mcp'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                currentPage === 'mcp'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Server className="w-4 h-4 text-white" />
                <span>MCP Tool Vetting</span>
              </div>
              <span className="text-2xs font-mono text-emerald-400">Pinned</span>
            </button>

            <div className="pt-2 pb-1 text-3xs font-mono uppercase tracking-wider text-slate-500 px-3">
              Policy &amp; Governance
            </div>

            <button
              type="button"
              onClick={() => { setCurrentPage('apps'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                currentPage === 'apps'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-white" />
                <span>Apps &amp; Permissions</span>
              </div>
              <span className="text-2xs font-mono text-slate-500">3</span>
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('policies'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                currentPage === 'policies'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileCode className="w-4 h-4 text-white" />
                <span>Policies &amp; Dry-Run</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('approvals'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                currentPage === 'approvals'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-white" />
                <span>Approval Queue</span>
              </div>
              {pendingApprovalsCount > 0 && (
                <span className="font-mono text-2xs bg-amber-500 text-slate-950 font-bold px-1.5 py-0.2 rounded-full">
                  {pendingApprovalsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('audit'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                currentPage === 'audit'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Link2 className="w-4 h-4 text-white" />
                <span>Audit Hash Chain</span>
              </div>
              <span className="text-2xs font-mono text-emerald-400">SHA-256</span>
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('compliance'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                currentPage === 'compliance'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-white" />
                <span>OWASP Top 10</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => { setCurrentPage('settings'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                currentPage === 'settings'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-white" />
                <span>Tenant Settings</span>
              </div>
            </button>

            <div className="pt-3 border-t border-slate-800/80 mt-3">
              <button
                type="button"
                onClick={() => { setCurrentPage('selftest'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  currentPage === 'selftest'
                    ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60 shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-4 h-4 text-white" />
                  <span>Self-Test Suite</span>
                </div>
                <span className="text-2xs font-mono text-emerald-400">100% Pass</span>
              </button>
            </div>
          </nav>

          {/* Left Sidebar Footer */}
          <div className="p-3 bg-[#070b14] border-t border-slate-800 text-2xs text-slate-500 font-mono">
            <div>Gateway Version: 1.0.1</div>
            <div>Action Gate: Active</div>
          </div>
        </aside>

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#070b14]">
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
