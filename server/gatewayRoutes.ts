import express from 'express';
import rateLimit from 'express-rate-limit';
import type { AppConfig } from './config.ts';
import { requireGatewayKey } from './http.ts';
import { GatewayDeps, GatewayResponse, handleApprovalStatus, handleChatCompletions, handleToolsExecute } from './gateway.ts';
import { executionService } from './services.ts';
import { eventLedger } from './ledger.ts';
import { policyEngine } from './policyEngine.ts';
import { DEFAULT_OUTPUT_ALLOWED_HOSTS } from './outputInspection.ts';
import { createClient, getGeminiModel, getGeminiStatus } from './gemini.ts';

/**
 * /v1/* gateway routes. They live in their own module because they authenticate with the gateway
 * key (agents/apps), not the admin token (human operators).
 */
export function defaultGatewayDeps(cfg: AppConfig): GatewayDeps {
  return {
    service: executionService,
    ledger: eventLedger,
    demoMode: cfg.demoMode,
    allowedHosts: () => {
      const r3 = policyEngine.getPolicy().rules.find((r) => r.id === 'R3_DOMAIN_ALLOWLIST' && r.enabled) as { allowedDomains?: string[] } | undefined;
      return r3?.allowedDomains ?? DEFAULT_OUTPUT_ALLOWED_HOSTS;
    },
    geminiAvailable: () => getGeminiStatus().state === 'available',
    callGemini: async (model, conversation) => {
      const name = model === 'gemini' ? getGeminiModel() : model;
      const ai = createClient(process.env.GEMINI_API_KEY ?? '');
      const r = await ai.models.generateContent({ model: name, contents: conversation });
      return r.text || '';
    },
  };
}

export function registerGatewayRoutes(app: express.Express, cfg: AppConfig, deps: GatewayDeps = defaultGatewayDeps(cfg)): void {
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, forwardedHeader: false, trustProxy: false },
    message: { error: { message: 'Too many requests', type: 'rate_limit_error' } },
  });
  const auth = requireGatewayKey(cfg) as unknown as express.RequestHandler;
  const send = (res: express.Response, r: GatewayResponse) => {
    for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
    res.status(r.status).json(r.body);
  };
  const toReq = (req: express.Request) => ({ body: req.body, headers: req.headers });

  app.use('/v1', limiter, auth);
  app.post('/v1/chat/completions', async (req, res, next) => {
    try {
      send(res, await handleChatCompletions(deps, toReq(req)));
    } catch (err) {
      next(err);
    }
  });
  app.post('/v1/tools/execute', async (req, res, next) => {
    try {
      send(res, await handleToolsExecute(deps, toReq(req)));
    } catch (err) {
      next(err);
    }
  });
  app.get('/v1/approvals/:id', (req, res) => send(res, handleApprovalStatus(deps, req.params.id)));
  app.all('/v1/*', (req, res) => {
    res.status(404).json({ error: { message: `Route ${req.method} ${req.path} not found`, type: 'not_found' } });
  });
}
