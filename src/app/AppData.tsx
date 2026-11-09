import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ApprovalItem, FirewallMode, Incident, OrgApp, ToolTaxonomy } from '../../server/types.ts';
import type { ScenarioDefinition } from '../../server/scenarios.ts';
import {
  AppConfigInfo,
  fetchAppConfig,
  fetchApprovals,
  fetchApps,
  fetchIncidents,
  fetchKillSwitchState,
  fetchLedgerEvents,
  fetchPolicy,
  fetchScenarios,
  resetSystemState,
} from '../services/api.ts';
import { buildNotifications, Notification, unreadCount } from '../lib/notifications.ts';
import { buildChecklist } from '../lib/onboarding.ts';
import { useToast } from '../ui/Toast.tsx';

const LS = {
  mode: 'armora.mode',
  seen: 'armora.notifications.seen',
  reviewed: 'armora.onboarding.reviewed',
  dismissed: 'armora.onboarding.dismissed',
};
const read = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

export interface AppData {
  incidents: Incident[];
  apps: OrgApp[];
  scenarios: ScenarioDefinition[];
  taxonomy: Record<string, ToolTaxonomy>;
  pending: ApprovalItem[];
  quarantinedAgents: string[];
  config: AppConfigInfo | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addIncident: (i: Incident) => void;
  setApps: React.Dispatch<React.SetStateAction<OrgApp[]>>;
  mode: FirewallMode;
  setMode: (m: FirewallMode) => void;
  notifications: Notification[];
  unread: number;
  markNotificationsSeen: () => void;
  checklist: ReturnType<typeof buildChecklist>;
  checklistDismissed: boolean;
  dismissChecklist: () => void;
  markIncidentReviewed: () => void;
  resetDemo: () => Promise<void>;
  /** modal state owned here so the command palette, top bar and pages can open them */
  runnerOpen: boolean;
  setRunnerOpen: (v: boolean) => void;
  tourOpen: boolean;
  setTourOpen: (v: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (v: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
}

const Ctx = createContext<AppData | null>(null);
export function useAppData(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppData must be used inside <AppDataProvider>');
  return v;
}

export const AppDataProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [apps, setApps] = useState<OrgApp[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>([]);
  const [taxonomy, setTaxonomy] = useState<Record<string, ToolTaxonomy>>({});
  const [pending, setPending] = useState<ApprovalItem[]>([]);
  const [quarantinedAgents, setQuarantined] = useState<string[]>([]);
  const [config, setConfig] = useState<AppConfigInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gatewayConnected, setGatewayConnected] = useState(false);
  const [mode, setModeState] = useState<FirewallMode>(() => {
    const m = read(LS.mode);
    return m === 'off' || m === 'shadow' || m === 'enforce' ? m : 'enforce';
  });
  const [lastSeen, setLastSeen] = useState<number>(() => Number(read(LS.seen) ?? 0) || 0);
  const [reviewed, setReviewed] = useState(() => read(LS.reviewed) === '1');
  const [dismissed, setDismissed] = useState(() => read(LS.dismissed) === '1');
  const [runnerOpen, setRunnerOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const [inc, ap, sc, apr, pol, ks, gw, cfg] = await Promise.all([
        fetchIncidents(),
        fetchApps(),
        fetchScenarios(),
        fetchApprovals(),
        fetchPolicy(),
        fetchKillSwitchState().catch(() => ({ quarantinedAgents: [] as string[] })),
        fetchLedgerEvents({ type: 'SESSION_START', agentId: 'agent_gateway_default', pageSize: 1 }).catch(() => ({ total: 0, items: [] })),
        fetchAppConfig().catch(() => null),
      ]);
      if (!mounted.current) return;
      setIncidents(inc);
      setApps(ap);
      setScenarios(sc);
      setPending(apr.pending);
      setTaxonomy(pol.taxonomy);
      setQuarantined((ks as { quarantinedAgents: string[] }).quarantinedAgents ?? []);
      setGatewayConnected(gw.total > 0);
      setConfig(cfg);
      setError(null);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Could not reach the server');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  // live updates (EventSource reconnects by itself)
  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const es = new EventSource('/api/events');
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'RUN_COMPLETE') setIncidents((p) => [msg.payload, ...p.filter((i) => i.id !== msg.payload.id)]);
        else if (msg.type === 'APPROVAL_QUEUED' || msg.type === 'APPROVAL_RESOLVED') fetchApprovals().then((d) => mounted.current && setPending(d.pending)).catch(() => undefined);
      } catch {
        /* ignore malformed frames */
      }
    };
    return () => es.close();
  }, []);

  const setMode = useCallback((m: FirewallMode) => {
    setModeState(m);
    write(LS.mode, m);
  }, []);

  const addIncident = useCallback((i: Incident) => setIncidents((p) => [i, ...p.filter((x) => x.id !== i.id)]), []);

  const notifications = useMemo(() => buildNotifications({ pending, incidents, lastSeenTs: lastSeen }), [pending, incidents, lastSeen]);
  const markNotificationsSeen = useCallback(() => {
    const now = Date.now();
    setLastSeen(now);
    write(LS.seen, String(now));
  }, []);

  const checklist = useMemo(
    () => buildChecklist({ gatewayConnected, scenarioRun: incidents.some((i) => !i.isSeeded), incidentReviewed: reviewed }),
    [gatewayConnected, incidents, reviewed]
  );
  const markIncidentReviewed = useCallback(() => {
    setReviewed(true);
    write(LS.reviewed, '1');
  }, []);
  const dismissChecklist = useCallback(() => {
    setDismissed(true);
    write(LS.dismissed, '1');
  }, []);

  const resetDemo = useCallback(async () => {
    try {
      const r = await resetSystemState();
      toast({ title: 'Demo data reset', description: r.message, tone: 'ok' });
      await refresh();
    } catch (e) {
      toast({ title: 'Reset failed', description: e instanceof Error ? e.message : 'Unknown error', tone: 'danger' });
    }
  }, [refresh, toast]);

  const value: AppData = {
    incidents,
    apps,
    scenarios,
    taxonomy,
    pending,
    quarantinedAgents,
    config,
    loading,
    error,
    refresh,
    addIncident,
    setApps,
    mode,
    setMode,
    notifications,
    unread: unreadCount(notifications),
    markNotificationsSeen,
    checklist,
    checklistDismissed: dismissed,
    dismissChecklist,
    markIncidentReviewed,
    resetDemo,
    runnerOpen,
    setRunnerOpen,
    tourOpen,
    setTourOpen,
    shortcutsOpen,
    setShortcutsOpen,
    paletteOpen,
    setPaletteOpen,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
