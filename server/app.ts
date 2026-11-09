import express, { Request, Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { agentRunner, subscribeToEvents } from './agentRunner.ts';
import { auditLog, AUDIT_ANCHOR_NOTE, AUDIT_INTEGRITY_NOTE } from './auditLog.ts';
import { policyEngine, TOOL_TAXONOMY, SEEDED_POLICY_VERSIONS } from './policyEngine.ts';
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
              'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
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
  app.post('/api/policy/dry-run', body(S.DryRunBody), (req, res) => {
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

  // 16. JSON 404 for unknown API routes
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.path} not found` });
  });

  app.use(errorHandler() as unknown as express.ErrorRequestHandler);
  return app;
}
