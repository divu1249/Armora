import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.ts';
import { errorHandler, requestId, requireAdmin, requireDemoMode, startHeartbeat, validateBody, type ReqLike, type ResLike } from '../http.ts';
import * as S from '../apiSchemas.ts';
import { agentRunner } from '../agentRunner.ts';
import { eq, skip, suite, yes } from './helpers.ts';

function fake(method = 'POST', headers: Record<string, string> = {}, body: unknown = {}) {
  const req: ReqLike = { method, headers, body };
  const out: { status: number; body: unknown; headers: Record<string, string>; nextCalled: boolean } = { status: 200, body: undefined, headers: {}, nextCalled: false };
  const res: ResLike = {
    status(c) { out.status = c; return res; },
    json(b) { out.body = b; return res; },
    setHeader(n, v) { out.headers[n] = v; return res; },
  };
  const next = () => { out.nextCalled = true; };
  return { req, res, out, next };
}
const run = (mw: (a: ReqLike, b: ResLike, c: () => void) => void, method: string, headers: Record<string, string> = {}, body: unknown = {}) => {
  const f = fake(method, headers, body);
  mw(f.req, f.res, f.next);
  return f;
};
const src = (rel: string) => {
  const f = path.resolve(process.cwd(), rel);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
};

export const apiCases = suite(7, 'Regression 7: API hardening', [
  ['DEMO_MODE defaults: true locally, false when NODE_ENV=production; explicit value wins', () => {
    const l = loadConfig({} as never).demoMode;
    const p = loadConfig({ NODE_ENV: 'production' } as never).demoMode;
    const o = loadConfig({ NODE_ENV: 'production', DEMO_MODE: 'true' } as never).demoMode;
    const f = loadConfig({ DEMO_MODE: 'false' } as never).demoMode;
    return eq([true, false, true, false], [l, p, o, f]);
  }],
  ['production: mutating route without ADMIN_TOKEN header => 401', () => {
    const f = run(requireAdmin({ production: true, adminToken: 'secret-token-123' }) as never, 'POST');
    return eq([401, false], [f.out.status, f.out.nextCalled]);
  }],
  ['production: wrong token => 401; correct x-admin-token or Bearer => allowed', () => {
    const mw = requireAdmin({ production: true, adminToken: 'secret-token-123' }) as never;
    const wrong = run(mw, 'POST', { 'x-admin-token': 'nope' });
    const ok1 = run(mw, 'POST', { 'x-admin-token': 'secret-token-123' });
    const ok2 = run(mw, 'POST', { authorization: 'Bearer secret-token-123' });
    return eq([401, true, true], [wrong.out.status, ok1.out.nextCalled, ok2.out.nextCalled]);
  }],
  ['production without ADMIN_TOKEN configured fails closed (503), never open', () => {
    const f = run(requireAdmin({ production: true, adminToken: undefined }) as never, 'POST', { 'x-admin-token': '' });
    return eq([503, false], [f.out.status, f.out.nextCalled]);
  }],
  ['non-production does not require the token (local demo)', () => {
    return eq(true, run(requireAdmin({ production: false, adminToken: undefined }) as never, 'POST').out.nextCalled);
  }],
  ['/api/audit/tamper is disabled unless DEMO_MODE=true', () => {
    const off = run(requireDemoMode({ demoMode: false }) as never, 'POST');
    const on = run(requireDemoMode({ demoMode: true }) as never, 'POST');
    return eq([404, false, true], [off.out.status, off.out.nextCalled, on.out.nextCalled]);
  }],
  ['overrideToolCall is only honoured under DEMO_MODE (route guard present in source)', () => {
    const t = src('server/app.ts');
    if (!t) return skip('source not available');
    return yes(/overrideToolCall && !cfg\.demoMode/.test(t) && /demoOnly, admin, body\(S\.AuditTamperBody\)/.test(t));
  }],
  ['every mutating route is admin-protected, except the documented compute-only ones', () => {
    const t = src('server/app.ts');
    if (!t) return skip('source not available');
    const routes = [...t.matchAll(/app\.(post|patch|put|delete)\(\s*'([^']+)'([^\n]*)/g)];
    const computeOnly = new Set(['/api/agent/run', '/api/policy/dry-run', '/api/redteam/run', '/api/redteam/adaptive', '/api/redteam/report/html']);
    const unprotected = routes.filter((m) => !m[3].includes('admin') && !computeOnly.has(m[2])).map((m) => m[2]);
    return eq([], unprotected, `${routes.length} mutating routes inspected`);
  }],
  ['every route with a body validates it with zod (body(...) present)', () => {
    const t = src('server/app.ts');
    if (!t) return skip('source not available');
    const routes = [...t.matchAll(/app\.(post|patch|put)\(\s*'([^']+)'([^\n]*)/g)];
    return eq([], routes.filter((m) => !m[3].includes('body(')).map((m) => m[2]));
  }],
  ['PATCH /api/apps/:id schema accepts only allow-listed fields', () => {
    const bad = [{ apiKey: 'x' }, { riskScore: 0 }, { id: 'evil' }, { __proto__: { admin: true }, name: 'x', blockedCount: 1 }, { status: 'SECURED' }, {}].map((b) => S.AppPatchBody.safeParse(b).success);
    const good = S.AppPatchBody.safeParse({ allowedTools: ['send_email'], environment: 'staging', name: 'x' }).success;
    return eq({ bad: bad.map(() => false), good: true }, { bad, good });
  }],
  ['updateApp never copies non-allow-listed properties from the body', () => {
    const before = JSON.stringify(agentRunner.getApps().find((a) => a.id === 'app_search'));
    const updated = agentRunner.updateApp('app_search', { riskScore: 0, apiKey: 'stolen', blockedCount: 999, status: 'SECURED', id: 'x' } as never);
    return eq(before, JSON.stringify(updated));
  }, { live: true }],
  ['agent run / approvals / policy / dry-run / kill switch / blocklist / MCP bodies reject unknown fields and bad values', () => {
    const cases = [
      S.AgentRunBody.safeParse({ scenarioId: 's1', extra: 1 }),
      S.AgentRunBody.safeParse({ scenarioId: 's1', firewallMode: 'nope' }),
      S.AgentRunBody.safeParse({ scenarioId: 's1', overrideToolCall: { tool: 'rm_rf', args: {} } }),
      S.ApprovalBody.safeParse({ action: 'MAYBE' }),
      S.PolicyBody.safeParse({ yamlContent: 5 }),
      S.DryRunBody.safeParse({ toolCall: { tool: 'send_email', args: {} }, segments: [] }),
      S.KillSwitchBody.safeParse({ agentId: '../x' }),
      S.BlocklistBody.safeParse({ indicator: '', ttlHours: -1 }),
      S.RugPullBody.safeParse({}),
      S.MarkFpBody.safeParse({ detectorName: 5 }),
    ].map((r) => r.success);
    return eq(cases.map(() => false), cases);
  }],
  ['validateBody replaces the body with the parsed value (defaults applied) and answers 400 on bad input', () => {
    const ok = run(validateBody(S.AgentRunBody) as never, 'POST', {}, { scenarioId: 's1' });
    const bad = run(validateBody(S.AgentRunBody) as never, 'POST', {}, { scenarioId: 's1', hack: true });
    return eq({ mode: 'enforce', badStatus: 400, badNext: false }, { mode: (ok.req.body as { firewallMode: string }).firewallMode, badStatus: bad.out.status, badNext: bad.out.nextCalled });
  }],
  ['safe error handler never leaks stack traces or internal messages and includes a request id', () => {
    const f = fake();
    f.req.id = 'req-12345678';
    const orig = console.error;
    console.error = () => {};
    try {
      (errorHandler() as never as (e: unknown, a: ReqLike, b: ResLike, n: () => void) => void)(new Error('ENOENT /etc/secret/path at Object.<anonymous> (file.ts:1:1)'), f.req, f.res, f.next);
    } finally {
      console.error = orig;
    }
    const text = JSON.stringify(f.out.body);
    return eq({ status: 500, leaked: false, rid: true }, { status: f.out.status, leaked: /ENOENT|secret|\.ts:|at Object/.test(text), rid: text.includes('req-12345678') });
  }],
  ['error handler maps oversize / malformed JSON bodies to 413 / 400', () => {
    const run1 = (type: string) => { const f = fake(); (errorHandler() as never as (e: unknown, a: ReqLike, b: ResLike, n: () => void) => void)({ type }, f.req, f.res, f.next); return f.out.status; };
    return eq([413, 400], [run1('entity.too.large'), run1('entity.parse.failed')]);
  }],
  ['request ids: valid inbound id kept, invalid replaced, X-Request-Id header set', () => {
    const a = run(requestId() as never, 'GET', { 'x-request-id': 'abc-12345678' });
    const b = run(requestId() as never, 'GET', { 'x-request-id': 'bad id with spaces <script>' });
    return eq({ keep: 'abc-12345678', replaced: true, hdr: true }, { keep: a.req.id, replaced: b.req.id !== 'bad id with spaces <script>' && /^[0-9a-f-]{36}$/.test(String(b.req.id)), hdr: Boolean(a.out.headers['X-Request-Id']) });
  }],
  ['SSE heartbeat writes comment frames on an interval', async () => {
    const chunks: string[] = [];
    const stop = startHeartbeat((c) => chunks.push(c), 5);
    await new Promise((r) => setTimeout(r, 30));
    stop();
    const n = chunks.length;
    await new Promise((r) => setTimeout(r, 20));
    return yes(n >= 2 && chunks[0] === ': heartbeat\n\n' && chunks.length === n, `frames=${n}`);
  }],
  ['source contract: CORS restricted to APP_URL, helmet CSP in production, rate limit on mutating routes, SSE heartbeat', () => {
    const t = src('server/app.ts');
    if (!t) return skip('source not available');
    return yes(
      /cors\(\{ origin: cfg\.appUrl \? \[cfg\.appUrl\] : false \}\)/.test(t) &&
        /contentSecurityPolicy: cfg\.production/.test(t) &&
        /mutatingLimiter/.test(t) &&
        /startHeartbeat/.test(t) &&
        !/\bcors\(\)/.test(t)
    );
  }],
]);
