import crypto from 'node:crypto';
import { ZodError, ZodTypeAny, z } from 'zod';
import { safeEqual } from './canonical.ts';
import type { AppConfig } from './config.ts';

/** Minimal structural types so these helpers are testable without express. */
export interface ReqLike {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  id?: string;
  path?: string;
}
export interface ResLike {
  status(code: number): ResLike;
  json(body: unknown): unknown;
  setHeader(name: string, value: string): unknown;
}
export type Next = (err?: unknown) => void;

export const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function requestId() {
  return (req: ReqLike, res: ResLike, next: Next): void => {
    const inbound = req.headers['x-request-id'];
    const candidate = Array.isArray(inbound) ? inbound[0] : inbound;
    req.id = candidate && /^[A-Za-z0-9-]{8,64}$/.test(candidate) ? candidate : crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  };
}

function headerValue(req: ReqLike, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

/**
 * In production every route wrapped with this requires the ADMIN_TOKEN (x-admin-token or Bearer).
 * If production has no ADMIN_TOKEN configured the routes are closed (503), never open.
 */
export function requireAdmin(cfg: Pick<AppConfig, 'production' | 'adminToken'>) {
  return (req: ReqLike, res: ResLike, next: Next): void => {
    if (!cfg.production) return next();
    if (!cfg.adminToken) {
      res.status(503).json({ error: 'ADMIN_TOKEN is not configured; mutating routes are disabled', requestId: req.id });
      return;
    }
    const bearer = headerValue(req, 'authorization')?.replace(/^Bearer\s+/i, '');
    const supplied = headerValue(req, 'x-admin-token') ?? bearer;
    if (!supplied || !safeEqual(supplied, cfg.adminToken)) {
      res.status(401).json({ error: 'Admin token required', requestId: req.id });
      return;
    }
    next();
  };
}

/**
 * Gateway clients authenticate with ARMORA_GATEWAY_KEY (Bearer). Optional locally so curl just works;
 * in production a missing key closes the gateway (503) instead of leaving it open.
 */
export function requireGatewayKey(cfg: Pick<AppConfig, 'production' | 'gatewayKey'>) {
  return (req: ReqLike, res: ResLike, next: Next): void => {
    if (!cfg.gatewayKey) {
      if (!cfg.production) return next();
      res.status(503).json({ error: { message: 'ARMORA_GATEWAY_KEY is not configured; the gateway is disabled in production', type: 'server_error' } });
      return;
    }
    const supplied = headerValue(req, 'authorization')?.replace(/^Bearer\s+/i, '');
    if (!supplied || !safeEqual(supplied, cfg.gatewayKey)) {
      res.status(401).json({ error: { message: 'Invalid or missing gateway key', type: 'authentication_error' } });
      return;
    }
    next();
  };
}

/** Route is available only when DEMO_MODE=true. */
export function requireDemoMode(cfg: Pick<AppConfig, 'demoMode'>) {
  return (req: ReqLike, res: ResLike, next: Next): void => {
    if (!cfg.demoMode) {
      res.status(404).json({ error: 'Not available: DEMO_MODE is off', requestId: req.id });
      return;
    }
    next();
  };
}

export function formatZodError(err: ZodError): string {
  return err.issues.map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`).join('; ');
}

/** Validates and REPLACES req.body with the parsed value (defaults applied, unknown keys rejected by .strict()). */
export function validateBody<S extends ZodTypeAny>(schema: S) {
  return (req: ReqLike, res: ResLike, next: Next): void => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: `Invalid request body: ${formatZodError(parsed.error)}`, requestId: req.id });
      return;
    }
    req.body = parsed.data as z.infer<S>;
    next();
  };
}

/** Never leaks stack traces or internal messages. */
export function errorHandler() {
  return (err: unknown, req: ReqLike, res: ResLike, _next: Next): void => {
    const e = err as { status?: number; statusCode?: number; type?: string } | undefined;
    const status = e?.status ?? e?.statusCode;
    let code = 500;
    let message = 'Internal server error';
    if (err instanceof ZodError) {
      code = 400;
      message = `Invalid request: ${formatZodError(err)}`;
    } else if (e?.type === 'entity.too.large') {
      code = 413;
      message = 'Request body too large';
    } else if (e?.type === 'entity.parse.failed') {
      code = 400;
      message = 'Malformed JSON body';
    } else if (typeof status === 'number' && status >= 400 && status < 500) {
      code = status;
      message = 'Bad request';
    }
    if (code === 500) console.error(`[error] request ${req.id}:`, err instanceof Error ? err.stack : err);
    res.status(code).json({ error: message, requestId: req.id });
  };
}

/** SSE keep-alive comment frames. Returns the stop function. */
export function startHeartbeat(write: (chunk: string) => void, intervalMs = 15_000): () => void {
  const t = setInterval(() => {
    try {
      write(': heartbeat\n\n');
    } catch {
      /* client gone */
    }
  }, intervalMs);
  t.unref?.();
  return () => clearInterval(t);
}
