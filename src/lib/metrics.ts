import type { Incident, OrgApp } from '../../server/types.ts';
import { bucketize, delta, Delta } from './sparkline.ts';

/**
 * Overview numbers. Everything here is computed from the incidents the server returned; nothing is
 * invented. Seeded sample incidents are counted (and reported separately) because they are in the list.
 */
export const HOUR = 3_600_000;
const NON_RULE_IDS = new Set(['DEFAULT_ALLOW', 'NO_TOOL_CALL']);

export interface Kpi {
  id: 'runs' | 'blocked' | 'held' | 'left';
  label: string;
  value: number;
  previous: number;
  delta: Delta;
  spark: number[];
  help: string;
}

export interface AttentionItem {
  id: string;
  severity: 'danger' | 'warn' | 'info';
  title: string;
  detail: string;
  to: string;
}

export interface CoverageRow {
  appId: string;
  name: string;
  tools: number;
  runs: number;
  enforce: number;
  shadow: number;
  off: number;
  blocked: number;
  held: number;
  /** share of this app's runs that went through the gate in enforce mode; null when there are no runs */
  enforcedShare: number | null;
}

export interface OverviewMetrics {
  windowHours: number;
  total: number;
  seeded: number;
  kpis: Kpi[];
  needsAttention: AttentionItem[];
  topRules: Array<{ ruleId: string; count: number }>;
  coverage: CoverageRow[];
  recent: Incident[];
}

const ts = (i: Incident) => Date.parse(i.timestamp);
const isBlocked = (i: Incident) => i.decision.action === 'deny';
const isHeld = (i: Incident) => i.decision.action === 'approve';

export function computeOverview(params: {
  incidents: readonly Incident[];
  apps: readonly OrgApp[];
  pendingApprovals: number;
  quarantinedAgents?: readonly string[];
  now?: number;
  windowHours?: number;
  recentCount?: number;
}): OverviewMetrics {
  const now = params.now ?? Date.now();
  const windowHours = params.windowHours ?? 24;
  const win = windowHours * HOUR;
  const incidents = params.incidents;
  const cur = incidents.filter((i) => ts(i) > now - win && ts(i) <= now);
  const prev = incidents.filter((i) => ts(i) > now - 2 * win && ts(i) <= now - win);
  const BUCKETS = 12;
  const spark = (pred: (i: Incident) => boolean) => bucketize(cur.filter(pred).map(ts), win / BUCKETS, BUCKETS, now);
  const kpi = (id: Kpi['id'], label: string, help: string, pred: (i: Incident) => boolean): Kpi => {
    const value = cur.filter(pred).length;
    const previous = prev.filter(pred).length;
    return { id, label, value, previous, delta: delta(value, previous), spark: spark(pred), help };
  };

  const needsAttention: AttentionItem[] = [];
  if (params.pendingApprovals > 0) {
    needsAttention.push({ id: 'approvals', severity: 'warn', title: `${params.pendingApprovals} action${params.pendingApprovals === 1 ? '' : 's'} waiting for approval`, detail: 'Held calls expire after 60 seconds.', to: '/app/approvals' });
  }
  for (const i of incidents.filter((x) => x.dataLeftPremises).slice(0, 3)) {
    needsAttention.push({ id: `left:${i.id}`, severity: 'danger', title: `Data left the premises: ${i.scenarioTitle}`, detail: `Mode ${i.firewallMode}. Review what was sent.`, to: `/app/incidents/${i.id}` });
  }
  for (const i of incidents.filter((x) => x.firewallMode === 'shadow' && x.decision.shadowWouldBlock && !x.dataLeftPremises).slice(0, 2)) {
    needsAttention.push({ id: `shadow:${i.id}`, severity: 'warn', title: `Shadow mode would have blocked: ${i.scenarioTitle}`, detail: 'The call was allowed because protection was in Shadow mode.', to: `/app/incidents/${i.id}` });
  }
  for (const i of incidents.filter((x) => x.llmFallbackReason).slice(0, 1)) {
    needsAttention.push({ id: `fallback:${i.id}`, severity: 'info', title: 'A Gemini run used the simulated agent', detail: 'Gemini was unavailable; the run is labelled as simulated.', to: `/app/incidents/${i.id}` });
  }
  for (const a of params.quarantinedAgents ?? []) {
    needsAttention.push({ id: `quarantine:${a}`, severity: 'info', title: `Agent ${a} is quarantined`, detail: 'Its tokens are revoked and new calls are blocked.', to: '/app/incidents' });
  }
  const rank = { danger: 0, warn: 1, info: 2 } as const;
  needsAttention.sort((a, b) => rank[a.severity] - rank[b.severity]);

  const counts = new Map<string, number>();
  for (const i of incidents) {
    const ids = i.decision.matchedRules?.length ? i.decision.matchedRules.map((m) => m.ruleId) : [i.decision.ruleId];
    for (const id of new Set(ids)) if (!NON_RULE_IDS.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const topRules = Array.from(counts, ([ruleId, count]) => ({ ruleId, count })).sort((a, b) => b.count - a.count || a.ruleId.localeCompare(b.ruleId)).slice(0, 6);

  const coverage: CoverageRow[] = params.apps.map((a) => {
    const mine = incidents.filter((i) => i.appId === a.id);
    const enforce = mine.filter((i) => i.firewallMode === 'enforce').length;
    return {
      appId: a.id,
      name: a.name,
      tools: a.allowedTools.length,
      runs: mine.length,
      enforce,
      shadow: mine.filter((i) => i.firewallMode === 'shadow').length,
      off: mine.filter((i) => i.firewallMode === 'off').length,
      blocked: mine.filter(isBlocked).length,
      held: mine.filter(isHeld).length,
      enforcedShare: mine.length ? Math.round((enforce / mine.length) * 100) : null,
    };
  });

  return {
    windowHours,
    total: incidents.length,
    seeded: incidents.filter((i) => i.isSeeded).length,
    kpis: [
      kpi('runs', 'Runs analysed', 'Agent runs that passed through the gateway in the window.', () => true),
      kpi('blocked', 'Actions blocked', 'Tool calls the gate denied.', isBlocked),
      kpi('held', 'Held for approval', 'Tool calls that needed a human decision.', isHeld),
      kpi('left', 'Data left premises', 'Runs where an email or payment really went out (should be 0 in Enforce).', (i) => i.dataLeftPremises),
    ],
    needsAttention,
    topRules,
    coverage,
    recent: [...incidents].sort((a, b) => ts(b) - ts(a)).slice(0, params.recentCount ?? 8),
  };
}
