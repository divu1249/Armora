import express, { Request, Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { agentRunner, subscribeToEvents } from './agentRunner.ts';
import { auditLog, AUDIT_ANCHOR_NOTE, AUDIT_INTEGRITY_NOTE } from './auditLog.ts';
import { policyEngine, TOOL_TAXONOMY, SEEDED_POLICY_VERSIONS, validatePolicy } from './policyEngine.ts';
import { OWASP_LLM_COMPLIANCE_MATRIX } from './compliance.ts';
import { protectedToolServer } from './protectedTools.ts';
import { runAllSelfTests } from './selfTest.ts';
import { SEEDED_SCENARIOS } from './scenarios.ts';
import { redTeamRunner, SYNTHETIC_ATTACK_LIBRARY } from './redteam.ts';
import { threatIntelEngine } from './threatIntel.ts';
import { trafficIntelligenceEngine } from './trafficIntel.ts';
import { incidentResponseEngine } from './incidentResponse.ts';
import { mcpVettingEngine } from './mcpVetting.ts';
import { getGeminiStatus } from './gemini.ts';
import { LEGACY_LABEL } from './legacyStandingKeyDemo.ts';
import type { AppConfig } from './config.ts';
import * as S from './apiSchemas.ts';
import { registerGatewayRoutes } from './gatewayRoutes.ts';
import { eventLedger } from './ledger.ts';
import { executionService } from './services.ts';
import { credentialBroker, tokenVerifier, MAX_TOKEN_TTL_SECONDS } from './credentialBroker.ts';
import { vault } from './vault.ts';
import { auditToCsv, auditToJsonl, filterAuditEntries } from './auditLog.ts';
import { aggregateTokens, buildInventory, queryCredentialLedger, scanForExposure, tokenDetail } from './credentialViews.ts';
import { buildEvidenceBundle } from './evidence.ts';
import { errorHandler, MUTATING_METHODS, requestId, requireAdmin, requireDemoMode, startHeartbeat, validateBody } from './http.ts';

export function createApp(cfg: AppConfig) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId() as unknown as express.RequestHandler);

  // CSP only for the production static build (Vite dev injects inline scripts).
  app.use(
    helmet({
      contentSecurityPolicy: cfg.production
        ? {
            useDefaults: true,
            directives: {
              'default-src': ["'self'"],
              'script-src': ["'self'"],
              'style-src': ["'self'", "'unsafe-inline'"],
              'font-src': ["'self'", 'data:'],
              'img-src': ["'self'", 'data:'],
              'connect-src': ["'self'"],
              'object-src': ["'none'"],
              'frame-ancestors': ["'none'"],
              'base-uri': ["'self'"],
              'form-action': ["'self'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS restricted to APP_URL; unset = same-origin only (no CORS headers at all).
  app.use(cors({ origin: cfg.appUrl ? [cfg.appUrl] : false }));
  app.use(express.json({ limit: '1mb' }));

  const limiterBase = {
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, forwardedHeader: false, trustProxy: false },
  } as const;
  const generalLimiter = rateLimit({ ...limiterBase, windowMs: 15 * 60 * 1000, max: 1000, message: { error: 'Too many requests, please try again shortly.' } });
  const mutatingLimiter = rateLimit({ ...limiterBase, windowMs: 60 * 1000, max: 30, message: { error: 'Too many write requests, slow down.' } });
  app.use('/api/', generalLimiter);
  app.use('/api/', (req, res, next) => (MUTATING_METHODS.has(req.method) ? mutatingLimiter(req, res, next) : next()));

  const admin = requireAdmin(cfg) as unknown as express.RequestHandler;
  const demoOnly = requireDemoMode(cfg) as unknown as express.RequestHandler;
  const body = (schema: Parameters<typeof validateBody>[0]) => validateBody(schema) as unknown as express.RequestHandler;
  const idParam = (req: Request, res: Response): string | null => {
    const p = S.ID_PARAM.safeParse(req.params.id);
    if (!p.success) {
      res.status(400).json({ error: 'Invalid id', requestId: (req as Request & { id?: string }).id });
      return null;
    }
    return p.data;
  };

  // --- Config / status ---
  app.get('/api/config', (_req, res) => {
    res.json({
      demoMode: cfg.demoMode,
      production: cfg.production,
      adminTokenRequired: cfg.production,
      legacyLabel: LEGACY_LABEL,
      gemini: getGeminiStatus(),
    });
  });
  app.get('/api/gemini/status', (_req, res) => res.json(getGeminiStatus()));

  // 1. Scenarios
  app.get('/api/scenarios', (_req, res) => {
    res.json({ scenarios: SEEDED_SCENARIOS });
  });

  // 2. Agent runner
  app.post('/api/agent/run', body(S.AgentRunBody), async (req, res, next) => {
    try {
      const { scenarioId, firewallMode, llmMode, overrideToolCall } = req.body;
      if (overrideToolCall && !cfg.demoMode) {
        res.status(403).json({ error: 'overrideToolCall is only available when DEMO_MODE=true' });
        return;
      }
      const incident = await agentRunner.runScenario({ scenarioId, firewallMode, llmMode, overrideToolCall });
      res.json({ success: true, incident });
    } catch (err) {
      next(err);
    }
  });

  // 3. Incidents & apps
  app.get('/api/incidents', (_req, res) => {
    res.json({ incidents: agentRunner.getAllIncidents() });
  });
  app.get('/api/incidents/:id', (req, res) => {
    const id = idParam(req, res);
    if (!id) return;
    const incident = agentRunner.getIncident(id);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    res.json({ incident });
  });
  app.get('/api/apps', (_req, res) => {
    res.json({ apps: agentRunner.getApps() });
  });
  app.patch('/api/apps/:id', admin, body(S.AppPatchBody), (req, res) => {
    const id = idParam(req, res);
    if (!id) return;
    const updated = agentRunner.updateApp(id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'App not found' });
      return;
    }
    res.json({ app: updated });
  });

  // 4. Approvals
  app.get('/api/approvals', (_req, res) => {
    res.json({ pending: agentRunner.getPendingApprovals(), all: agentRunner.getAllApprovals() });
  });
  app.post('/api/approvals/:id', admin, body(S.ApprovalBody), async (req, res, next) => {
    try {
      const id = idParam(req, res);
      if (!id) return;
      res.json(await agentRunner.resolveApproval(id, req.body.action, req.body.notes));
    } catch (err) {
      next(err);
    }
  });

  // 5. Policy
  app.get('/api/policy', (_req, res) => {
    res.json({ policyYaml: policyEngine.getPolicyYaml(), taxonomy: TOOL_TAXONOMY });
  });
  app.post('/api/policy', admin, body(S.PolicyBody), (req, res) => {
    const result = policyEngine.setPolicyYaml(req.body.yamlContent);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ success: true, message: 'Policy successfully updated', warnings: result.warnings });
  });
  // compute-only: validates a draft policy without saving it
  app.post('/api/policy/validate', body(S.PolicyBody), (req, res) => {
    res.json(validatePolicy(req.body.yamlContent));
  });
  app.post('/api/policy/dry-run', body(S.DryRunBody), (req, res) => {
    if (req.body.policyYaml) {
      const v = validatePolicy(req.body.policyYaml);
      if (!v.ok) {
        res.status(400).json({ error: `Draft policy is invalid: ${v.error}` });
        return;
      }
    }
    res.json(agentRunner.dryRun(req.body));
  });
  app.get('/api/policy/versions', (_req, res) => {
    res.json({ versions: SEEDED_POLICY_VERSIONS });
  });
  app.get('/api/compliance', (_req, res) => {
    res.json(OWASP_LLM_COMPLIANCE_MATRIX);
  });

  // 6. Audit log
  app.get('/api/audit', (_req, res) => {
    const entries = auditLog.getEntries();
    res.json({ entries, totalEntries: entries.length, integrityNote: AUDIT_INTEGRITY_NOTE });
  });
  app.get('/api/audit/verify', (_req, res) => {
    res.json({ report: auditLog.verifyChain() });
  });
  app.get('/api/audit/anchors', (_req, res) => {
    res.json({ anchors: auditLog.getAnchors(), note: AUDIT_ANCHOR_NOTE });
  });
  app.post('/api/audit/anchor', admin, body(S.EmptyBody), (_req, res) => {
    res.json({ anchor: auditLog.createAnchor(), note: AUDIT_ANCHOR_NOTE });
  });
  // Demo-only: disabled unless DEMO_MODE=true (and admin-gated in production).
  app.post('/api/audit/tamper', demoOnly, admin, body(S.AuditTamperBody), (req, res) => {
    const result = auditLog.tamperEntry(req.body.seq, req.body.forgedData);
    res.json({ success: true, tamperedSeq: result.tamperedSeq });
  });

  // 7. Protected tool stores
  app.get('/api/tools/outbox', (_req, res) => {
    res.json({
      outbox: protectedToolServer.getOutbox(),
      refunds: protectedToolServer.getRefunds(),
      candidates: protectedToolServer.getCandidates(),
      orders: protectedToolServer.getOrders(),
    });
  });

  // 8. Self-tests
  app.get('/api/selftest', async (_req, res, next) => {
    try {
      res.json({ report: await runAllSelfTests() });
    } catch (err) {
      next(err);
    }
  });

  // 9. Reset
  app.post('/api/reset', admin, body(S.EmptyBody), (_req, res) => {
    agentRunner.resetAll();
    res.json({ success: true, message: 'State reset; audit log archived and restarted from a new genesis entry.' });
  });

  // 10. SSE with heartbeat
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);
    const unsubscribe = subscribeToEvents((event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    const stopHeartbeat = startHeartbeat((chunk) => res.write(chunk));
    req.on('close', () => {
      stopHeartbeat();
      unsubscribe();
    });
  });

  // 11. Red team
  app.get('/api/redteam/attacks', (_req, res) => {
    res.json({ attacks: SYNTHETIC_ATTACK_LIBRARY });
  });
  app.post('/api/redteam/run', body(S.RedteamRunBody), (req, res) => {
    res.json({ report: redTeamRunner.runSuite(req.body.firewallMode) });
  });
  app.post('/api/redteam/adaptive', body(S.AdaptiveBody), (req, res) => {
    res.json({ report: redTeamRunner.runAdaptiveAttack(req.body.attackId, req.body.maxAttempts) });
  });
  app.post('/api/redteam/report/html', body(S.ReportHtmlBody), (req, res) => {
    res.json({ html: redTeamRunner.generatePrintableHtml(req.body.report) });
  });

  // 12. Threat intel
  app.get('/api/intel/enrich/:indicator', (req, res) => {
    const indicator = String(req.params.indicator).slice(0, 253);
    res.json({ enrichment: threatIntelEngine.enrichIndicator(indicator) });
  });
  app.get('/api/intel/campaigns', (_req, res) => {
    res.json({ campaigns: threatIntelEngine.getCampaigns() });
  });
  app.get('/api/intel/blocklist', (_req, res) => {
    res.json({ blocklist: threatIntelEngine.getBlocklist() });
  });
  app.post('/api/intel/blocklist', admin, body(S.BlocklistBody), (req, res) => {
    res.json({ success: true, entry: threatIntelEngine.addBlocklistEntry(req.body) });
  });
  app.post('/api/intel/blocklist/:id/approve', admin, body(S.ApproverBody), (req, res) => {
    const id = idParam(req, res);
    if (!id) return;
    res.json({ success: threatIntelEngine.approveBlocklistEntry(id, req.body.approver) });
  });
  app.post('/api/intel/blocklist/:id/allowlist', admin, body(S.EmptyBody), (req, res) => {
    const id = idParam(req, res);
    if (!id) return;
    res.json({ success: threatIntelEngine.allowlistEntry(id) });
  });
  app.get('/api/intel/blocklist/export-stix', (_req, res) => {
    res.json(threatIntelEngine.exportStixJson());
  });

  // 13. Traffic intel
  app.get('/api/traffic/series', (req, res) => {
    const appId = typeof req.query.appId === 'string' && S.ID_PARAM.safeParse(req.query.appId).success ? req.query.appId : undefined;
    res.json({ series: trafficIntelligenceEngine.getTimeSeries(appId) });
  });
  app.get('/api/traffic/accounts', (_req, res) => {
    res.json({ accounts: trafficIntelligenceEngine.getRiskyAccounts() });
  });
  app.get('/api/traffic/detectors', (_req, res) => {
    res.json({ detectors: trafficIntelligenceEngine.getDetectorHealth() });
  });
  app.post('/api/traffic/mark-fp', admin, body(S.MarkFpBody), (req, res) => {
    trafficIntelligenceEngine.markDetectorFalsePositive(req.body.detectorName);
    res.json({ success: true, detectors: trafficIntelligenceEngine.getDetectorHealth() });
  });

  // 14. Incident response
  const withIncident = (fn: (incident: NonNullable<ReturnType<typeof agentRunner.getIncident>>) => unknown, key: string) =>
    (req: Request, res: Response) => {
      const id = idParam(req, res);
      if (!id) return;
      const incident = agentRunner.getIncident(id) || agentRunner.getAllIncidents()[0];
      if (!incident) {
        res.status(404).json({ error: 'Incident not found' });
        return;
      }
      res.json({ [key]: fn(incident) });
    };
  app.get('/api/response/blast-radius/:id', withIncident((i) => incidentResponseEngine.generateBlastRadiusGraph(i), 'graph'));
  app.get('/api/response/kill-switch', (_req, res) => {
    res.json(incidentResponseEngine.getKillSwitchState());
  });
  app.post('/api/response/kill-switch', admin, body(S.KillSwitchBody), (req, res) => {
    const { agentId, enableQuarantine, reason } = req.body;
    res.json(incidentResponseEngine.toggleKillSwitch(agentId, enableQuarantine, reason));
  });
  app.get('/api/response/reports/:id', withIncident((i) => incidentResponseEngine.generateReportDrafts(i), 'drafts'));
  app.get('/api/response/timeline/:id', withIncident((i) => incidentResponseEngine.generateTimeline(i), 'timeline'));

  // 15. MCP vetting
  app.get('/api/mcp/tools', (_req, res) => {
    res.json({ tools: mcpVettingEngine.getTools() });
  });
  app.post('/api/mcp/rug-pull', admin, body(S.RugPullBody), (req, res) => {
    res.json(mcpVettingEngine.simulateRugPull(req.body.toolId));
  });
  app.post('/api/mcp/reset', admin, body(S.EmptyBody), (_req, res) => {
    mcpVettingEngine.resetMcpRegistry();
    res.json({ success: true, tools: mcpVettingEngine.getTools() });
  });

  // --- Gateway (agents / apps): /v1/chat/completions, /v1/tools/execute, /v1/approvals/:id ---
  registerGatewayRoutes(app, cfg);

  // --- Logs: search, filters, pagination, per-entry proofs, export ---
  const parseQuery = <T extends { safeParse: (v: unknown) => any }>(schema: T, req: Request, res: Response) => {
    const p = schema.safeParse(req.query);
    if (!p.success) {
      res.status(400).json({ error: `Invalid query: ${p.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ')}` });
      return null;
    }
    return p.data as any;
  };
  app.get('/api/audit/entries', (req, res) => {
    const q = parseQuery(S.AuditQueryParams, req, res);
    if (!q) return;
    res.json({ ...auditLog.query(q), verification: auditLog.verifyChain() });
  });
  app.get('/api/audit/entries/:seq/proof', (req, res) => {
    const seq = Number(req.params.seq);
    if (!Number.isInteger(seq) || seq < 0) {
      res.status(400).json({ error: 'Invalid seq' });
      return;
    }
    const proof = auditLog.proveEntry(seq);
    if (!proof) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.json({ proof });
  });
  app.get('/api/audit/export', (req, res) => {
    const q = parseQuery(S.AuditQueryParams, req, res);
    if (!q) return;
    const items = filterAuditEntries(auditLog.getEntries(), q).slice(0, 10000);
    if (q.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="armora-audit.csv"');
      res.send(auditToCsv(items));
    } else {
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="armora-audit.jsonl"');
      res.send(auditToJsonl(items));
    }
  });
  app.get('/api/ledger/events', (req, res) => {
    const q = parseQuery(S.LedgerQueryParams, req, res);
    if (!q) return;
    res.json(eventLedger.query(q));
  });
  app.get('/api/ledger/verify', (_req, res) => {
    res.json({ ledger: eventLedger.verify(), audit: auditLog.verifyChain() });
  });

  // --- Evidence bundle (JSON) for one session ---
  app.get('/api/response/evidence/:id', (req, res) => {
    const id = idParam(req, res);
    if (!id) return;
    const bundle = buildEvidenceBundle(
      { ledger: eventLedger, audit: auditLog, outbox: protectedToolServer.getOutbox(), refunds: protectedToolServer.getRefunds(), incident: agentRunner.getIncident(id) ?? null },
      id
    );
    res.setHeader('Content-Disposition', `attachment; filename="armora-evidence-${id}.json"`);
    res.json(bundle);
  });

  // --- Credentials: ledger, inventory, TTL, key rotation ---
  app.get('/api/credentials/ledger', (req, res) => {
    const q = parseQuery(S.CredentialQueryParams, req, res);
    if (!q) return;
    credentialBroker.sweepExpired();
    res.json(queryCredentialLedger(eventLedger.all(), q));
  });
  app.get('/api/credentials/ledger/:jti', (req, res) => {
    const jti = idParam({ ...req, params: { id: req.params.jti } } as unknown as Request, res);
    if (!jti) return;
    const d = tokenDetail(eventLedger.all(), jti);
    if (!d) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }
    res.json(d);
  });
  app.get('/api/credentials/inventory', (_req, res) => {
    credentialBroker.sweepExpired();
    const apps = agentRunner.getApps();
    const agents = SEEDED_SCENARIOS.map((sc) => ({ agentId: `agent_${sc.id}`, appName: sc.appName, allowedTools: apps.find((a) => a.id === sc.appId)?.allowedTools ?? [] }));
    agents.push({ agentId: 'agent_gateway_default', appName: 'Gateway (default agent)', allowedTools: Object.keys(TOOL_TAXONOMY) });
    const exposure = scanForExposure(vault, {
      incidents: agentRunner.getAllIncidents(),
      ledgerEvents: eventLedger.all(),
      auditEntries: auditLog.getEntries(),
      outbox: protectedToolServer.getOutbox(),
      refunds: protectedToolServer.getRefunds(),
    });
    res.json({
      ...buildInventory({ events: eventLedger.all(), agents, isQuarantined: (id) => incidentResponseEngine.isAgentQuarantined(id), exposure, vaultStatus: vault.status(), legacyLabel: LEGACY_LABEL }),
      broker: { kid: credentialBroker.kid, ttlSeconds: credentialBroker.getTtlSeconds(), maxTtlSeconds: MAX_TOKEN_TTL_SECONDS, process: 'single process (broker, vault and tool server share it in this prototype)' },
    });
  });
  app.get('/api/credentials/config', (_req, res) => {
    res.json({ kid: credentialBroker.kid, ttlSeconds: credentialBroker.getTtlSeconds(), maxTtlSeconds: MAX_TOKEN_TTL_SECONDS, outstanding: credentialBroker.outstandingCount() });
  });
  app.post('/api/credentials/ttl', admin, body(S.TtlBody), (req, res) => {
    const previous = credentialBroker.getTtlSeconds();
    const ttl = credentialBroker.setTtl(req.body.ttlSeconds);
    eventLedger.record({ sessionId: 'credential_admin', type: 'TTL_CHANGED', action: 'ttl_changed', data: { previous, ttlSeconds: ttl } });
    res.json({ ttlSeconds: ttl, maxTtlSeconds: MAX_TOKEN_TTL_SECONDS, note: 'Applies to newly issued tokens only.' });
  });
  app.post('/api/credentials/rotate', admin, body(S.EmptyBody), (_req, res) => {
    const r = credentialBroker.rotateKey();
    res.json({ ...r, note: 'The previous public key stays valid for at most one token TTL, then is retired.' });
  });

  // 16. JSON 404 for unknown API routes
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.path} not found` });
  });

  app.use(errorHandler() as unknown as express.ErrorRequestHandler);
  return app;
}
