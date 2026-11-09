import fs from 'node:fs';
import path from 'node:path';
import { dump, load } from 'js-yaml';
import { DEFAULT_POLICY_YAML, validatePolicy } from '../policyEngine.ts';
import { eq, skip, suite, yes } from './helpers.ts';

/**
 * Item 14: frontend redesign. These tests cover what can be verified without a browser: pure logic,
 * the brand/token config (including WCAG contrast), the route table, code splitting and honesty rules
 * for the marketing pages. Rendering, Lighthouse and keyboard behaviour are NOT covered here.
 */
const root = process.cwd();
const src = (rel: string) => {
  const f = path.resolve(root, rel);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
};
const walk = (dir: string, out: string[] = []): string[] => {
  const d = path.resolve(root, dir);
  if (!fs.existsSync(d)) return out;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};
const hasSrc = () => fs.existsSync(path.resolve(root, 'src/App.tsx'));
const lib = async <T>(rel: string): Promise<T | null> => {
  if (!hasSrc()) return null;
  return (await import(`../../src/${rel}`)) as T;
};

// ---- WCAG 2.x contrast
const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const lum = (c: [number, number, number]) => 0.2126 * lin(c[0] / 255) + 0.7152 * lin(c[1] / 255) + 0.0722 * lin(c[2] / 255);
const ratio = (a: [number, number, number], b: [number, number, number]) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const blend = (fg: [number, number, number], bg: [number, number, number], alpha: number): [number, number, number] => fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha))) as [number, number, number];

type Brand = typeof import('../../src/brand.ts');
const incident = (o: Record<string, unknown>) =>
  ({ id: 'i', scenarioTitle: 'T', timestamp: new Date(0).toISOString(), firewallMode: 'enforce', decision: { action: 'allow', ruleId: 'DEFAULT_ALLOW' }, dataLeftPremises: false, isSeeded: false, appId: 'a', ...o }) as never;

export const frontendCases = suite(14, 'Regression 14: Frontend (design system, routes, honesty, logic)', [
  ['brand: name and tagline are defined once and match the spec', async () => {
    const b = await lib<Brand>('brand.ts');
    if (!b) return skip('src not available');
    return eq({ name: 'Armora', tagline: 'Agent action firewall' }, { name: b.BRAND.name, tagline: b.BRAND.tagline });
  }],
  ['brand: no hard-coded product name or old branding outside brand.ts', () => {
    if (!hasSrc()) return skip('src not available');
    const files = [...walk('src'), 'index.html'].filter((f) => /\.(tsx?|html|css)$/.test(f) && !f.endsWith('brand.ts'));
    const hits = files.filter((f) => /LLM\s*Firewall|CYBERSEC|Cyber\s*Shield/i.test(src(f) ?? ''));
    return eq([], hits);
  }],
  ['tokens: every text/background pair meets WCAG AA (4.5:1) in both themes', async () => {
    const b = await lib<Brand>('brand.ts');
    if (!b) return skip('src not available');
    const fails: string[] = [];
    for (const name of ['dark', 'light'] as const) {
      const p = b.THEMES[name];
      const bgs = ['canvas', 'surface', 'subtle', 'raised'] as const;
      for (const bg of bgs) {
        for (const fg of ['fg', 'fg2', 'muted', 'accent', 'ok', 'warn', 'danger', 'info'] as const) {
          const r = ratio(rgb(p[fg]), rgb(p[bg]));
          if (r < 4.5) fails.push(`${name}: ${fg} on ${bg} = ${r.toFixed(2)}`);
        }
      }
      for (const s of ['accentSolid', 'okSolid', 'warnSolid', 'dangerSolid', 'infoSolid'] as const) {
        const r = ratio(rgb(p.onSolid), rgb(p[s]));
        if (r < 4.5) fails.push(`${name}: onSolid on ${s} = ${r.toFixed(2)}`);
      }
      for (const f of ['codeFg', 'codeMuted'] as const) {
        const r = ratio(rgb(p[f]), rgb(p.code));
        if (r < 4.5) fails.push(`${name}: ${f} on code = ${r.toFixed(2)}`);
      }
      // status text on its own 10% tint over the surface (Badge, alerts)
      for (const [fg, solid] of [['ok', 'okSolid'], ['warn', 'warnSolid'], ['danger', 'dangerSolid'], ['info', 'infoSolid'], ['accent', 'accentSolid']] as const) {
        const tint = blend(rgb(p[solid]), rgb(p.surface), 0.1);
        const r = ratio(rgb(p[fg]), tint);
        if (r < 4.5) fails.push(`${name}: ${fg} on tinted ${solid} = ${r.toFixed(2)}`);
      }
    }
    return eq([], fails);
  }],
  ['tokens: index.css fallback variables mirror THEMES.dark', async () => {
    const b = await lib<Brand>('brand.ts');
    const css = src('src/index.css');
    if (!b || !css) return skip('src not available');
    const root0 = css.match(/:root\s*{([^}]*)}/)?.[1] ?? '';
    const mismatches: string[] = [];
    for (const key of Object.keys(b.THEMES.dark) as Array<keyof Brand['THEMES']['dark']>) {
      const v = root0.match(new RegExp(`${b.cssVar(key)}:\\s*([^;]+);`))?.[1]?.trim();
      if (v?.toLowerCase() !== b.THEMES.dark[key].toLowerCase()) mismatches.push(`${key}: css=${v} brand=${b.THEMES.dark[key]}`);
    }
    return eq([], mismatches);
  }],
  ['tokens: 8px grid, radius and elevation tokens exist; fonts are self-hosted (no CDN)', async () => {
    const b = await lib<Brand>('brand.ts');
    const html = src('index.html');
    const main = src('src/main.tsx');
    const pkg = src('package.json');
    if (!b || !html || !main || !pkg) return skip('src not available');
    return eq(
      { unit: 8, radius: true, elevation: true, cdn: false, inter: true, mono: true },
      { unit: b.TOKENS.space.unit, radius: Boolean(b.TOKENS.radius.md), elevation: Boolean(b.TOKENS.elevation[2]), cdn: /fonts\.(googleapis|gstatic)\.com/.test(html), inter: /@fontsource-variable\/inter/.test(main) && /@fontsource-variable\/inter/.test(pkg), mono: /@fontsource-variable\/jetbrains-mono/.test(main) }
    );
  }],
  ['tokens: no hard-coded hex or Tailwind palette colors remain in components', () => {
    if (!hasSrc()) return skip('src not available');
    const files = walk('src').filter((f) => f.endsWith('.tsx') || f.endsWith('.ts')).filter((f) => !f.endsWith('src/brand.ts'));
    const bad: string[] = [];
    for (const f of files) {
      const t = src(f) ?? '';
      if (/\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide)-\[#|\b(?:bg|text|border|ring|divide)-(?:slate|gray|zinc|rose|emerald|amber|cyan|indigo|violet|purple|blue)-\d{2,3}|cyber-|glow-text|scanlines|font-heading/.test(t)) bad.push(f);
    }
    return eq([], bad);
  }],
  ['routes: every required path exists in the router and in the navigation model', async () => {
    const nav = await lib<typeof import('../../src/lib/nav.ts')>('lib/nav.ts');
    const app = src('src/App.tsx');
    if (!nav || !app) return skip('src not available');
    const required = ['/', '/pricing', '/docs', '/app/overview', '/app/feed', '/app/incidents', '/app/incidents/:id', '/app/approvals', '/app/policies', '/app/credentials', '/app/audit', '/app/redteam', '/app/intelligence', '/app/traffic', '/app/mcp', '/app/compliance', '/app/settings'];
    const known = new Set([...nav.PUBLIC_ROUTE_PATTERNS, ...nav.APP_ROUTE_PATTERNS]);
    const missingFromNav = required.filter((r) => !known.has(r));
    // every app pattern must have a <Route path="..."> (relative to /app) in App.tsx
    const missingFromRouter = nav.APP_ROUTE_PATTERNS.filter((p) => !new RegExp(`path="${p.replace('/app/', '')}"`).test(app));
    const publicMissing = ['pricing', 'docs'].filter((p) => !new RegExp(`path="${p}"`).test(app));
    return eq({ missingFromNav: [], missingFromRouter: [], publicMissing: [], notFound: true }, { missingFromNav, missingFromRouter, publicMissing, notFound: /path="\*"/.test(app) });
  }],
  ['navigation: sidebar groups follow the spec order and Settings is separate', async () => {
    const nav = await lib<typeof import('../../src/lib/nav.ts')>('lib/nav.ts');
    if (!nav) return skip('src not available');
    const g = (id: string) => nav.NAV_GROUPS.find((x) => x.id === id)?.items.map((i) => i.id).filter((i) => !['apps'].includes(i));
    return eq(
      { monitor: ['overview', 'feed'], protect: ['policies', 'credentials', 'approvals'], investigate: ['incidents', 'audit', 'intelligence', 'traffic'], govern: ['compliance', 'redteam', 'mcp'], settings: '/app/settings', order: ['monitor', 'protect', 'investigate', 'govern'] },
      { monitor: g('monitor'), protect: g('protect'), investigate: g('investigate'), govern: g('govern'), settings: nav.SETTINGS_ITEM.path, order: nav.NAV_GROUPS.slice(0, 4).map((x) => x.id) }
    );
  }],
  ['code splitting: every page is lazy-loaded; App.tsx has no static page imports', () => {
    const app = src('src/App.tsx');
    if (!app) return skip('src not available');
    const staticPageImports = app.split('\n').filter((l) => /^import\b/.test(l) && /(pages\/|Page\.tsx|Route\.tsx)/.test(l) && !/lazy/.test(l) && !/Layout/.test(l));
    const lazyCount = (app.match(/lazy\(\(\) => import\(/g) ?? []).length;
    return eq({ staticPageImports: [], lazyAtLeast: true, errorBoundary: true, router: true }, { staticPageImports, lazyAtLeast: lazyCount >= 20, errorBoundary: /ErrorBoundary/.test(app) || /ErrorBoundary/.test(src('src/main.tsx') ?? ''), router: /BrowserRouter/.test(app) });
  }],
  ['marketing pages contain no invented statistics, logos, testimonials or unverifiable claims', () => {
    if (!hasSrc()) return skip('src not available');
    const files = ['src/pages/public/LandingPage.tsx', 'src/pages/public/PricingPage.tsx', 'src/pages/public/diagrams.tsx', 'src/lib/pricing.ts'];
    const bad: string[] = [];
    for (const f of files) {
      const t = src(f) ?? '';
      const stripped = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      const checks: Array<[string, RegExp]> = [
        ['percentage', /\d+(?:\.\d+)?\s*%/],
        ['multiplier', /\b\d+x\b/],
        ['k/M plus', /\b\d+\s*(?:k|M)\+/],
        ['trusted by', /trusted by/i],
        ['testimonial', /testimonial/i],
        ['customers claim', /\b(?:our|\d+) customers\b/i],
        ['SOC 2 / ISO', /SOC ?2|ISO ?27001|HIPAA certified/i],
        ['speed claim', /\bfaster\b|\b10x\b|blazing/i],
        ['uptime claim', /99\.\d+/],
      ];
      for (const [label, re] of checks) if (re.test(stripped)) bad.push(`${f}: ${label}`);
    }
    return eq([], bad);
  }],
  ['landing page: shows what Armora does not do, a security model, pricing, FAQ, and both CTAs', () => {
    const t = src('src/pages/public/LandingPage.tsx');
    if (!t) return skip('src not available');
    return eq(
      { cta1: true, cta2: true, notDo: true, security: true, pricing: true, faq: true, pillars: true },
      { cta1: /Open live demo/.test(t), cta2: /Watch the 3-minute walkthrough/.test(t), notDo: /does not do/i.test(t), security: /security model/i.test(t), pricing: /PricingSection/.test(t), faq: /FAQ/.test(t), pillars: /Prevent/.test(t) && /Contain/.test(t) && /Prove/.test(t) }
    );
  }],
  ['pricing is labelled illustrative and offers the three plans', async () => {
    const p = await lib<typeof import('../../src/lib/pricing.ts')>('lib/pricing.ts');
    if (!p) return skip('src not available');
    return eq({ note: true, plans: ['Developer', 'Team', 'Enterprise'] }, { note: /illustrative/i.test(p.PRICING_NOTE), plans: p.PLANS.map((x) => x.name.replace(/^Free\s+/, '')) });
  }],
  ['mode control: switching protection to Off requires a confirmation dialog', () => {
    const t = src('src/app/ModeControl.tsx');
    if (!t) return skip('src not available');
    // the 'off' button must open the dialog (setConfirmOff) and only the dialog's confirm button may call setMode('off')
    const direct = (t.match(/setMode\('off'\)/g) ?? []).length;
    return eq({ dialog: true, opensConfirm: true, setModeOffCalls: 1, explainsRisk: true }, { dialog: /<Dialog/.test(t), opensConfirm: /setConfirmOff\(true\)/.test(t), setModeOffCalls: direct, explainsRisk: /standing key/.test(t) && /never expires/.test(t) });
  }],
  ['demo badge, org switcher honesty and command palette shortcut exist in the shell', () => {
    const top = src('src/app/TopBar.tsx');
    const shell = src('src/app/AppShell.tsx');
    const pal = src('src/app/CommandPalette.tsx');
    if (!top || !shell || !pal) return skip('src not available');
    return eq({ badge: true, roadmap: true, paletteKey: true, bell: true }, { badge: /demoBadge/.test(top + shell), roadmap: /ROADMAP/.test(top), paletteKey: /metaKey|ctrlKey/.test(shell + top + pal), bell: /Bell/.test(top) });
  }],
  ['accessibility (static): images have alt, svgs are labelled or hidden, dialogs use role=dialog, skip link exists', () => {
    if (!hasSrc()) return skip('src not available');
    const bad: string[] = [];
    for (const f of walk('src').filter((x) => x.endsWith('.tsx'))) {
      const t = src(f) ?? '';
      for (const m of t.matchAll(/<img\b[^>]*>/g)) if (!/\balt=/.test(m[0])) bad.push(`${f}: img without alt`);
      for (const m of t.matchAll(/<svg\b[^>]*>/g)) if (!/aria-hidden|role=|aria-label/.test(m[0]) && !/\{\.\.\./.test(m[0])) bad.push(`${f}: svg without role/aria-hidden`);
    }
    const shell = src('src/app/AppShell.tsx') ?? '';
    const dialog = src('src/ui/Dialog.tsx') ?? '';
    const legacy = ['src/components/DemoTourModal.tsx', 'src/components/QuickScenarioRunnerModal.tsx'].filter((f) => !/role="dialog"/.test(src(f) ?? '') || !/useOverlay/.test(src(f) ?? ''));
    return eq({ bad: [], skip: true, dialog: true, legacy: [] }, { bad, skip: /skip/i.test(shell), dialog: /role="dialog"/.test(dialog) && /aria-modal/.test(dialog), legacy });
  }],
  ['animations stay under 200ms and are disabled for prefers-reduced-motion', () => {
    const css = src('src/index.css');
    if (!css) return skip('src not available');
    // the infinite loading shimmer on skeletons is a progress indicator, not a transition: exempt it
    const checked = css.split('\n').filter((l) => !/infinite/.test(l)).join('\n');
    const durations = [...checked.matchAll(/(\d+(?:\.\d+)?)(ms|s)\b/g)].map((m) => (m[2] === 's' ? Number(m[1]) * 1000 : Number(m[1])));
    return eq({ allUnder200: true, reduced: true }, { allUnder200: durations.every((d) => d <= 200), reduced: /prefers-reduced-motion/.test(css) });
  }],
  ['guided tour, split screen, status chips and real-vs-simulated page are preserved', async () => {
    if (!hasSrc()) return skip('src not available');
    const badge = src('src/ui/Badge.tsx') ?? '';
    const chips = ['BUILT', 'PROTOTYPE', 'SEEDED', 'PRECOMPUTED', 'ROADMAP'].filter((c) => !new RegExp(c).test(badge));
    const files = ['src/components/DemoTourModal.tsx', 'src/components/pages/SplitScreenPage.tsx', 'src/components/pages/RealVsSimulatedPage.tsx'].filter((f) => !src(f));
    return eq({ chips: [], files: [] }, { chips, files });
  }],
  ['static API keys are never displayed in the UI; gateway auth describes short-lived tokens', () => {
    if (!hasSrc()) return skip('src not available');
    const shown = walk('src').filter((f) => f.endsWith('.tsx')).filter((f) => /\{[^}]*\.apiKey\b[^}]*\}/.test(src(f) ?? ''));
    const settings = src('src/pages/app/SettingsPage.tsx') ?? '';
    return eq({ shown: [], tokens: true }, { shown, tokens: /short-lived/i.test(settings) });
  }],
  ['settings: team roles and billing are labelled as mock/illustrative', () => {
    const t = src('src/pages/app/SettingsPage.tsx');
    if (!t) return skip('src not available');
    return yes(/mock|sample|demo/i.test(t) && /illustrative|PRICING_NOTE/i.test(t));
  }],
  // ---- pure logic
  ['DataTable logic: sortRows is stable, numeric-aware and puts empty values last; nextSort cycles asc, desc, off', async () => {
    const t = await lib<typeof import('../../src/lib/tableLogic.ts')>('lib/tableLogic.ts');
    if (!t) return skip('src not available');
    const rows = [{ n: 10, k: 'a' }, { n: 2, k: 'b' }, { n: undefined, k: 'c' }, { n: 2, k: 'd' }];
    const asc = t.sortRows(rows, (r) => r.n, 'asc').map((r) => r.k).join('');
    const desc = t.sortRows(rows, (r) => r.n, 'desc').map((r) => r.k).join('');
    const strs = t.sortRows(['item10', 'item2', 'Item1'], (x) => x, 'asc').join(',');
    const s1 = t.nextSort(null, 'x');
    const s2 = t.nextSort(s1, 'x');
    const s3 = t.nextSort(s2, 'x');
    const s4 = t.nextSort(s1, 'y');
    return eq({ asc: 'bdac', desc: 'abdc', strs: 'Item1,item2,item10', cycle: ['asc', 'desc', null], switched: 'y' }, { asc, desc, strs, cycle: [s1?.dir, s2?.dir, s3], switched: s4?.key });
  }],
  ['DataTable logic: paginate clamps pages and reports ranges', async () => {
    const t = await lib<typeof import('../../src/lib/tableLogic.ts')>('lib/tableLogic.ts');
    if (!t) return skip('src not available');
    const rows = Array.from({ length: 23 }, (_, i) => i);
    const p1 = t.paginate(rows, 1, 10);
    const p3 = t.paginate(rows, 99, 10);
    const empty = t.paginate([], 5, 10);
    return eq({ p1: [10, 1, 3, 1, 10], p3: [3, 3, 21, 23], empty: [0, 1, 0, 0] }, { p1: [p1.rows.length, p1.page, p1.pageCount, p1.from, p1.to], p3: [p3.rows.length, p3.page, p3.from, p3.to], empty: [empty.rows.length, empty.page, empty.from, empty.to] });
  }],
  ['sparkline helpers: path, buckets and deltas (no invented percentage when previous is 0)', async () => {
    const s = await lib<typeof import('../../src/lib/sparkline.ts')>('lib/sparkline.ts');
    if (!s) return skip('src not available');
    const path1 = s.sparklinePath([0, 10], 100, 20, 0);
    const flat = s.sparklinePath([5, 5, 5], 100, 20, 0);
    const up = s.delta(15, 10);
    return eq(
      { path1: 'M0.0 20.0 L100.0 0.0', flatNoNaN: true, empty: '', up: [5, 50, 'up'], zeroPrev: null, down: 'down', flatDir: 'flat' },
      { path1, flatNoNaN: !/NaN/.test(flat), empty: s.sparklinePath([], 10, 10), up: [up.value, up.percent, up.direction], zeroPrev: s.delta(3, 0).percent, down: s.delta(1, 4).direction, flatDir: s.delta(2, 2).direction }
    );
  }],
  ['bucketize places timestamps in the right bucket and ignores out-of-window values', async () => {
    const s = await lib<typeof import('../../src/lib/sparkline.ts')>('lib/sparkline.ts');
    if (!s) return skip('src not available');
    return eq([2, 0, 1, 1], s.bucketize([0, 4, 10, 19, -5, 25], 5, 4, 20));
  }],
  ['policy diff: diffLines marks added and removed lines and keeps unchanged ones', async () => {
    const d = await lib<typeof import('../../src/lib/diff.ts')>('lib/diff.ts');
    if (!d) return skip('src not available');
    const out = d.diffLines('a\nb\nc', 'a\nc\nd');
    return eq({ lines: ['same:a', 'remove:b', 'same:c', 'add:d'], stats: { added: 1, removed: 1 }, identical: 0 }, { lines: out.map((x) => `${x.type}:${x.text}`), stats: d.diffStats(out), identical: d.diffStats(d.diffLines('x', 'x')).added });
  }],
  ['command palette search ranks prefix over substring over keyword and every page is searchable', async () => {
    const nav = await lib<typeof import('../../src/lib/nav.ts')>('lib/nav.ts');
    if (!nav) return skip('src not available');
    const cmds = nav.pageCommands();
    const top = (q: string) => nav.searchCommands(q, cmds)[0]?.path;
    return eq(
      { audit: '/app/audit', policy: '/app/policies', byKeyword: '/app/credentials', none: 0, all: nav.ALL_NAV_ITEMS.length },
      { audit: top('aud'), policy: top('polic'), byKeyword: top('vault'), none: nav.searchCommands('zzzzqq', cmds).length, all: cmds.length }
    );
  }],
  ['overview metrics are computed from incidents: counts, deltas, top rules, coverage and attention items', async () => {
    const m = await lib<typeof import('../../src/lib/metrics.ts')>('lib/metrics.ts');
    if (!m) return skip('src not available');
    const now = Date.parse('2026-01-10T12:00:00Z');
    const at = (h: number) => new Date(now - h * 3_600_000).toISOString();
    const incidents = [
      incident({ id: '1', timestamp: at(1), decision: { action: 'deny', ruleId: 'R2_TRIFECTA', matchedRules: [{ ruleId: 'R2_TRIFECTA' }] } }),
      incident({ id: '2', timestamp: at(2), decision: { action: 'deny', ruleId: 'R2_TRIFECTA' } }),
      incident({ id: '3', timestamp: at(3), decision: { action: 'approve', ruleId: 'R4_FINANCIAL_GUARD' } }),
      incident({ id: '4', timestamp: at(5), firewallMode: 'off', dataLeftPremises: true }),
      incident({ id: '5', timestamp: at(30), decision: { action: 'deny', ruleId: 'R2_TRIFECTA' } }),
    ];
    const o = m.computeOverview({ incidents, apps: [{ id: 'a', name: 'App', allowedTools: ['x', 'y'] }] as never, pendingApprovals: 2, now });
    const k = (id: string) => o.kpis.find((x) => x.id === id)!;
    const c = o.coverage[0];
    return eq(
      { runs: [4, 1], blocked: [2, 1], held: 1, left: 1, top: ['R2_TRIFECTA', 3], attention: ['danger', 'warn'], cov: [2, 5, 4], sparkLen: 12, total: 5 },
      { runs: [k('runs').value, k('runs').previous], blocked: [k('blocked').value, k('blocked').previous], held: k('held').value, left: k('left').value, top: [o.topRules[0].ruleId, o.topRules[0].count], attention: o.needsAttention.map((a) => a.severity).slice(0, 2), cov: [c.tools, c.runs, c.enforce], sparkLen: k('runs').spark.length, total: o.total }
    );
  }],
  ['notifications: pending approvals always show; seeded incidents never notify; unread follows last-seen', async () => {
    const n = await lib<typeof import('../../src/lib/notifications.ts')>('lib/notifications.ts');
    if (!n) return skip('src not available');
    const list = n.buildNotifications({
      pending: [{ id: 'p1', toolCall: { tool: 'send_email' }, reason: 'needs a human', createdAt: 5000 }] as never,
      incidents: [incident({ id: 'new', timestamp: new Date(4000).toISOString() }), incident({ id: 'old', timestamp: new Date(1000).toISOString() }), incident({ id: 'seed', isSeeded: true, timestamp: new Date(9000).toISOString() })],
      lastSeenTs: 2000,
    });
    return eq({ ids: ['approval:p1', 'incident:new', 'incident:old'], unread: 2 }, { ids: list.map((x) => x.id), unread: n.unreadCount(list) });
  }],
  ['onboarding checklist reflects real state and completes only when all three steps are done', async () => {
    const o = await lib<typeof import('../../src/lib/onboarding.ts')>('lib/onboarding.ts');
    if (!o) return skip('src not available');
    const none = o.buildChecklist({ gatewayConnected: false, scenarioRun: false, incidentReviewed: false });
    const some = o.buildChecklist({ gatewayConnected: true, scenarioRun: false, incidentReviewed: true });
    const all = o.buildChecklist({ gatewayConnected: true, scenarioRun: true, incidentReviewed: true });
    return eq({ none: [0, false], some: [2, false], all: [3, true], ids: ['connect', 'run', 'review'] }, { none: [none.done, none.complete], some: [some.done, some.complete], all: [all.done, all.complete], ids: all.steps.map((s) => s.id) });
  }],
  ['policy editor logic: rule cards parse, toggling enabled round-trips, bad YAML reports an error and is returned unchanged', async () => {
    const p = await lib<typeof import('../../src/lib/policyEdit.ts')>('lib/policyEdit.ts');
    if (!p) return skip('src not available');
    const yaml = 'version: 1\nname: t\nrules:\n  - id: R1_EXTERNAL_UNTRUSTED\n    name: One\n    enabled: true\n  - id: R2_TRIFECTA\n    name: Two\n    enabled: true\n';
    const toggled = p.parsePolicyForView(p.setRuleEnabled(yaml, 'R2_TRIFECTA', false));
    const bad = 'rules: [unclosed';
    const parsedBad = p.parsePolicyForView(bad);
    return eq({ ids: ['R1_EXTERNAL_UNTRUSTED', 'R2_TRIFECTA'], enabled: [true, false], badOk: false, badHasError: true, unchanged: true }, { ids: toggled.rules.map((r) => r.id), enabled: toggled.rules.map((r) => r.enabled), badOk: parsedBad.ok, badHasError: Boolean(parsedBad.error), unchanged: p.setRuleEnabled(bad, 'R1', false) === bad });
  }],
  ['policy validation: validatePolicy accepts the default policy, rejects bad YAML, warns about unlisted rules; the route is compute-only', () => {
    const good = validatePolicy(DEFAULT_POLICY_YAML);
    const doc = load(DEFAULT_POLICY_YAML) as { rules: unknown[] };
    doc.rules = doc.rules.slice(0, -1);
    const partial = validatePolicy(dump(doc));
    const bad = validatePolicy('rules: [unclosed');
    const notMapping = validatePolicy('just a string');
    const app = src('server/app.ts');
    return eq({ goodOk: true, warns: true, badOk: false, badError: true, notMapping: false, route: true }, { goodOk: good.ok, warns: partial.ok && partial.warnings.length === 1 && good.warnings.length === 0, badOk: bad.ok, badError: Boolean(bad.error), notMapping: notMapping.ok, route: app === null ? true : /app\.post\('\/api\/policy\/validate'/.test(app) });
  }],
  ['dry-run accepts a draft policy without saving it', () => {
    const t = src('server/agentRunner.ts');
    const s = src('server/apiSchemas.ts');
    if (!t || !s) return skip('server source not available');
    return yes(/policyYaml/.test(s) && /new PolicyEngine\(/.test(t));
  }],
]);
