import express, { Request, Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { agentRunner, subscribeToEvents } from './server/agentRunner.ts';
import { auditLog } from './server/auditLog.ts';
import { policyEngine, TOOL_TAXONOMY, SEEDED_POLICY_VERSIONS } from './server/policyEngine.ts';
import { OWASP_LLM_COMPLIANCE_MATRIX } from './server/compliance.ts';
import { protectedToolServer } from './server/protectedTools.ts';
import { runAllSelfTests } from './server/selfTest.ts';
import { SEEDED_SCENARIOS } from './server/scenarios.ts';
import { redTeamRunner, SYNTHETIC_ATTACK_LIBRARY } from './server/redteam.ts';
import { threatIntelEngine } from './server/threatIntel.ts';
import { trafficIntelligenceEngine } from './server/trafficIntel.ts';
import { incidentResponseEngine } from './server/incidentResponse.ts';
import { mcpVettingEngine } from './server/mcpVetting.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Cloud Run / reverse proxy support
  app.set('trust proxy', 1);

  // Security headers & basic middleware
  app.use(
    helmet({
      contentSecurityPolicy: false, // Vite dev server injects inline scripts & styles
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // Rate limiting (generous for prototype testing behind reverse proxy)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
      xForwardedForHeader: false,
      forwardedHeader: false,
      trustProxy: false,
    },
    message: { error: 'Too many requests, please try again shortly.' },
  });
  app.use('/api/', limiter);

  // --- API Endpoints ---

  // 1. Scenarios
  app.get('/api/scenarios', (_req: Request, res: Response) => {
    res.json({ scenarios: SEEDED_SCENARIOS });
  });

  // 2. Agent Execution Runner
  app.post('/api/agent/run', async (req: Request, res: Response) => {
    try {
      const { scenarioId, firewallMode = 'enforce', llmMode = 'mock', overrideToolCall } = req.body;
      const incident = await agentRunner.runScenario({
        scenarioId,
        firewallMode,
        llmMode,
        overrideToolCall,
      });
      res.json({ success: true, incident });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: msg });
    }
  });

  // 3. Incidents
  app.get('/api/incidents', (_req: Request, res: Response) => {
    res.json({ incidents: agentRunner.getAllIncidents() });
  });

  app.get('/api/incidents/:id', (req: Request, res: Response) => {
    const incident = agentRunner.getIncident(req.params.id);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    res.json({ incident });
  });

  // 3b. AI Agents / Apps Inventory & Tool Permissions
  app.get('/api/apps', (_req: Request, res: Response) => {
    res.json({ apps: agentRunner.getApps() });
  });

  app.patch('/api/apps/:id', (req: Request, res: Response) => {
    const updated = agentRunner.updateApp(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'App not found' });
      return;
    }
    res.json({ app: updated });
  });

  // 4. Action Gate Approvals Queue
  app.get('/api/approvals', (_req: Request, res: Response) => {
    res.json({
      pending: agentRunner.getPendingApprovals(),
      all: agentRunner.getAllApprovals(),
    });
  });

  app.post('/api/approvals/:id', async (req: Request, res: Response) => {
    try {
      const { action, notes } = req.body; // 'APPROVE' or 'DENY'
      if (action !== 'APPROVE' && action !== 'DENY') {
        res.status(400).json({ error: 'Invalid action. Must be APPROVE or DENY.' });
        return;
      }
      const result = await agentRunner.resolveApproval(req.params.id, action, notes);
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: msg });
    }
  });

  // 5. Policy Engine & Tool Taxonomy
  app.get('/api/policy', (_req: Request, res: Response) => {
    res.json({
      policyYaml: policyEngine.getPolicyYaml(),
      taxonomy: TOOL_TAXONOMY,
    });
  });

  app.post('/api/policy', (req: Request, res: Response) => {
    const { yamlContent } = req.body;
    if (!yamlContent) {
      res.status(400).json({ error: 'Missing yamlContent body' });
      return;
    }
    const updateResult = policyEngine.setPolicyYaml(yamlContent);
    if (!updateResult.success) {
      res.status(400).json({ error: updateResult.error });
      return;
    }
    res.json({ success: true, message: 'Policy successfully updated' });
  });

  app.post('/api/policy/dry-run', (req: Request, res: Response) => {
    try {
      const { toolCall, segments, firewallMode = 'enforce' } = req.body;
      if (!toolCall || !segments) {
        res.status(400).json({ error: 'toolCall and segments required for dry-run simulation' });
        return;
      }
      const result = agentRunner.dryRun({ toolCall, segments, firewallMode });
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/policy/versions', (_req: Request, res: Response) => {
    res.json({ versions: SEEDED_POLICY_VERSIONS });
  });

  // 5b. OWASP Top 10 for LLMs Architectural Compliance Matrix
  app.get('/api/compliance', (_req: Request, res: Response) => {
    res.json(OWASP_LLM_COMPLIANCE_MATRIX);
  });

  // 6. Cryptographic Audit Hash Chain
  app.get('/api/audit', (_req: Request, res: Response) => {
    res.json({
      entries: auditLog.getEntries(),
      totalEntries: auditLog.getEntries().length,
    });
  });

  app.get('/api/audit/verify', (_req: Request, res: Response) => {
    const report = auditLog.verifyChain();
    res.json({ report });
  });

  app.post('/api/audit/tamper', (req: Request, res: Response) => {
    const { seq = 1, forgedData = { note: 'Tampered malicious data' } } = req.body;
    const result = auditLog.tamperEntry(Number(seq), forgedData);
    res.json({ success: true, tamperedSeq: result.tamperedSeq });
  });

  // 7. Protected Tools Store Inspection (Outbox, Refunds, Candidates)
  app.get('/api/tools/outbox', (_req: Request, res: Response) => {
    res.json({
      outbox: protectedToolServer.getOutbox(),
      refunds: protectedToolServer.getRefunds(),
      candidates: protectedToolServer.getCandidates(),
      orders: protectedToolServer.getOrders(),
    });
  });

  // 8. Self-Test Suite Runner
  app.get('/api/selftest', (_req: Request, res: Response) => {
    const report = runAllSelfTests();
    res.json({ report });
  });

  // 9. Reset All State
  app.post('/api/reset', (_req: Request, res: Response) => {
    agentRunner.resetAll();
    res.json({ success: true, message: 'LLM Firewall state and audit chain reset to genesis.' });
  });

  // 10. Server-Sent Events (SSE) Stream
  app.get('/api/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Initial ping
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

    const unsubscribe = subscribeToEvents((event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    req.on('close', () => {
      unsubscribe();
    });
  });

  // --- NEW ENTERPRISE EXTENSION MODULE ENDPOINTS ---

  // 11. Red-Team Runner Endpoints
  app.get('/api/redteam/attacks', (_req: Request, res: Response) => {
    res.json({ attacks: SYNTHETIC_ATTACK_LIBRARY });
  });

  app.post('/api/redteam/run', (req: Request, res: Response) => {
    const { firewallMode = 'enforce' } = req.body;
    const report = redTeamRunner.runSuite(firewallMode);
    res.json({ report });
  });

  app.post('/api/redteam/adaptive', (req: Request, res: Response) => {
    const { attackId = 'atk_01', maxAttempts = 8 } = req.body;
    const report = redTeamRunner.runAdaptiveAttack(attackId, Number(maxAttempts));
    res.json({ report });
  });

  app.post('/api/redteam/report/html', (req: Request, res: Response) => {
    const { report } = req.body;
    if (!report) {
      res.status(400).json({ error: 'Report object required' });
      return;
    }
    const html = redTeamRunner.generatePrintableHtml(report);
    res.json({ html });
  });

  // 12. Attack Intelligence Endpoints
  app.get('/api/intel/enrich/:indicator', (req: Request, res: Response) => {
    const enrichment = threatIntelEngine.enrichIndicator(req.params.indicator);
    res.json({ enrichment });
  });

  app.get('/api/intel/campaigns', (_req: Request, res: Response) => {
    res.json({ campaigns: threatIntelEngine.getCampaigns() });
  });

  app.get('/api/intel/blocklist', (_req: Request, res: Response) => {
    res.json({ blocklist: threatIntelEngine.getBlocklist() });
  });

  app.post('/api/intel/blocklist', (req: Request, res: Response) => {
    const { indicator, type = 'domain', scope = 'organization', mode = 'block', ttlHours = 720, appealNote } = req.body;
    if (!indicator) {
      res.status(400).json({ error: 'Indicator required' });
      return;
    }
    const entry = threatIntelEngine.addBlocklistEntry({
      indicator,
      type,
      scope,
      mode,
      ttlHours: Number(ttlHours),
      appealNote,
    });
    res.json({ success: true, entry });
  });

  app.post('/api/intel/blocklist/:id/approve', (req: Request, res: Response) => {
    const { approver = 'soc-operator@company.internal' } = req.body;
    const ok = threatIntelEngine.approveBlocklistEntry(req.params.id, approver);
    res.json({ success: ok });
  });

  app.post('/api/intel/blocklist/:id/allowlist', (req: Request, res: Response) => {
    const ok = threatIntelEngine.allowlistEntry(req.params.id);
    res.json({ success: ok });
  });

  app.get('/api/intel/blocklist/export-stix', (_req: Request, res: Response) => {
    res.json(threatIntelEngine.exportStixJson());
  });

  // 13. Traffic Intelligence Endpoints
  app.get('/api/traffic/series', (req: Request, res: Response) => {
    const appId = req.query.appId as string | undefined;
    const points = trafficIntelligenceEngine.getTimeSeries(appId);
    res.json({ series: points });
  });

  app.get('/api/traffic/accounts', (_req: Request, res: Response) => {
    res.json({ accounts: trafficIntelligenceEngine.getRiskyAccounts() });
  });

  app.get('/api/traffic/detectors', (_req: Request, res: Response) => {
    res.json({ detectors: trafficIntelligenceEngine.getDetectorHealth() });
  });

  app.post('/api/traffic/mark-fp', (req: Request, res: Response) => {
    const { detectorName } = req.body;
    if (!detectorName) {
      res.status(400).json({ error: 'detectorName required' });
      return;
    }
    trafficIntelligenceEngine.markDetectorFalsePositive(detectorName);
    res.json({ success: true, detectors: trafficIntelligenceEngine.getDetectorHealth() });
  });

  // 14. AI Incident Response Endpoints
  app.get('/api/response/blast-radius/:id', (req: Request, res: Response) => {
    const incident = agentRunner.getIncident(req.params.id) || agentRunner.getAllIncidents()[0];
    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    const graph = incidentResponseEngine.generateBlastRadiusGraph(incident);
    res.json({ graph });
  });

  app.get('/api/response/kill-switch', (_req: Request, res: Response) => {
    res.json(incidentResponseEngine.getKillSwitchState());
  });

  app.post('/api/response/kill-switch', (req: Request, res: Response) => {
    const { agentId, enableQuarantine = true, reason = 'Operator triggered emergency kill switch' } = req.body;
    if (!agentId) {
      res.status(400).json({ error: 'agentId required' });
      return;
    }
    const result = incidentResponseEngine.toggleKillSwitch(agentId, Boolean(enableQuarantine), reason);
    res.json(result);
  });

  app.get('/api/response/reports/:id', (req: Request, res: Response) => {
    const incident = agentRunner.getIncident(req.params.id) || agentRunner.getAllIncidents()[0];
    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    const drafts = incidentResponseEngine.generateReportDrafts(incident);
    res.json({ drafts });
  });

  app.get('/api/response/timeline/:id', (req: Request, res: Response) => {
    const incident = agentRunner.getIncident(req.params.id) || agentRunner.getAllIncidents()[0];
    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    const timeline = incidentResponseEngine.generateTimeline(incident);
    res.json({ timeline });
  });

  // 15. MCP Tool Vetting Endpoints
  app.get('/api/mcp/tools', (_req: Request, res: Response) => {
    res.json({ tools: mcpVettingEngine.getTools() });
  });

  app.post('/api/mcp/rug-pull', (req: Request, res: Response) => {
    const { toolId } = req.body;
    if (!toolId) {
      res.status(400).json({ error: 'toolId required' });
      return;
    }
    const result = mcpVettingEngine.simulateRugPull(toolId);
    res.json(result);
  });

  app.post('/api/mcp/reset', (_req: Request, res: Response) => {
    mcpVettingEngine.resetMcpRegistry();
    res.json({ success: true, tools: mcpVettingEngine.getTools() });
  });

  // 16. Explicit JSON 404 handler for unmatched /api/* routes
  // Prevents API requests from falling through to the Vite SPA HTML handler
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({ error: `API route ${req.method} ${req.path} not found` });
  });

  // Mount Vite dev server middlewares for client SPA
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LLM Firewall] Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[LLM Firewall] Fatal server boot error:', err);
  process.exit(1);
});
