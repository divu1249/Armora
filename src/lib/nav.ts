/** The navigation model: used by the router, the sidebar, the command palette and the tests. */
export type NavGroupId = 'monitor' | 'protect' | 'investigate' | 'govern' | 'learn';

export interface NavItem {
  id: string;
  label: string;
  /** absolute app path */
  path: string;
  /** key into the icon map used by the sidebar */
  icon: string;
  description: string;
  keywords: string[];
}

export interface NavGroup {
  id: NavGroupId;
  label: string;
  items: NavItem[];
}

const item = (id: string, label: string, path: string, icon: string, description: string, keywords: string[] = []): NavItem => ({ id, label, path, icon, description, keywords });

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'monitor',
    label: 'Monitor',
    items: [
      item('overview', 'Overview', '/app/overview', 'LayoutDashboard', 'Key numbers and what needs attention', ['home', 'dashboard', 'kpi']),
      item('feed', 'Live feed', '/app/feed', 'Radio', 'Events as agents run', ['stream', 'events', 'realtime']),
    ],
  },
  {
    id: 'protect',
    label: 'Protect',
    items: [
      item('policies', 'Policies', '/app/policies', 'ScrollText', 'Rules, versions and dry-run tester', ['rules', 'yaml', 'gate']),
      item('credentials', 'Credentials', '/app/credentials', 'KeyRound', 'One-time tokens and the standing-credentials inventory', ['tokens', 'vault', 'keys', 'ttl']),
      item('approvals', 'Approvals', '/app/approvals', 'CheckSquare', 'Actions waiting for a human decision', ['queue', 'human', 'review']),
      item('apps', 'Apps', '/app/apps', 'Boxes', 'Protected apps and the tools each may use', ['agents', 'tools', 'inventory']),
    ],
  },
  {
    id: 'investigate',
    label: 'Investigate',
    items: [
      item('incidents', 'Incidents', '/app/incidents', 'ShieldAlert', 'Every run, with evidence and blast radius', ['runs', 'forensics', 'blast radius']),
      item('audit', 'Audit', '/app/audit', 'FileClock', 'Tamper-evident log with per-entry proofs', ['logs', 'hash chain', 'anchors', 'proof']),
      item('intelligence', 'Intelligence', '/app/intelligence', 'Globe', 'Campaigns and blocklist', ['threat intel', 'campaigns', 'blocklist']),
      item('traffic', 'Traffic', '/app/traffic', 'TrendingUp', 'Request baselines and risky accounts', ['anomaly', 'baseline']),
    ],
  },
  {
    id: 'govern',
    label: 'Govern',
    items: [
      item('compliance', 'Compliance', '/app/compliance', 'ClipboardCheck', 'OWASP LLM Top 10 mapping', ['owasp', 'controls']),
      item('redteam', 'Red team', '/app/redteam', 'Crosshair', 'Attack suite and adaptive attacker', ['attacks', 'benchmark', 'test']),
      item('mcp', 'MCP', '/app/mcp', 'Server', 'Tool specification vetting', ['mcp', 'tools', 'rug pull']),
    ],
  },
  {
    id: 'learn',
    label: 'Learn',
    items: [
      item('compare', 'With vs without', '/app/compare', 'Split', 'Same attack, firewall off and on', ['split screen', 'compare', 'demo']),
      item('real-vs-simulated', 'Real vs simulated', '/app/real-vs-simulated', 'Layers', 'What is real code and what is simulated', ['honesty', 'limits']),
      item('selftest', 'Self-test', '/app/selftest', 'FlaskConical', 'Run the built-in verification suite', ['tests', 'regression']),
    ],
  },
];

export const SETTINGS_ITEM: NavItem = item('settings', 'Settings', '/app/settings', 'Settings', 'Organization, team, gateway authentication, billing', ['org', 'team', 'billing', 'theme']);

export const ALL_NAV_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];

/** Every path the router must serve (exact app paths + the incident detail pattern). */
export const APP_ROUTE_PATTERNS: string[] = [...ALL_NAV_ITEMS.map((i) => i.path), '/app/incidents/:id'];
export const PUBLIC_ROUTE_PATTERNS: string[] = ['/', '/pricing', '/docs'];

export function findNavItem(pathname: string): NavItem | undefined {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return ALL_NAV_ITEMS.find((i) => clean === i.path || clean.startsWith(`${i.path}/`));
}

export interface Command {
  id: string;
  label: string;
  hint: string;
  kind: 'page' | 'incident' | 'action';
  path?: string;
  keywords: string[];
}

/** Simple, predictable ranking: exact prefix > word prefix > substring > keyword. */
export function searchCommands(query: string, commands: readonly Command[], limit = 12): Command[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands.slice(0, limit);
  const scored: Array<{ c: Command; score: number }> = [];
  for (const c of commands) {
    const label = c.label.toLowerCase();
    let score = 0;
    if (label.startsWith(q)) score = 100;
    else if (label.split(/[\s/_-]+/).some((w) => w.startsWith(q))) score = 80;
    else if (label.includes(q)) score = 60;
    else if (c.keywords.some((k) => k.toLowerCase().includes(q))) score = 40;
    else if (c.hint.toLowerCase().includes(q)) score = 20;
    if (score > 0) scored.push({ c, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.c.label.localeCompare(b.c.label)).slice(0, limit).map((x) => x.c);
}

export function pageCommands(): Command[] {
  return ALL_NAV_ITEMS.map((i) => ({ id: `page:${i.id}`, label: i.label, hint: i.description, kind: 'page' as const, path: i.path, keywords: i.keywords }));
}
