import {
  ApprovalItem,
  AuditEntry,
  Finding,
  FirewallMode,
  GateDecision,
  Incident,
  LLMMode,
  OrgApp,
  PolicyVersion,
  ToolTaxonomy,
} from '../../server/types.ts';
import { ScenarioDefinition } from '../../server/scenarios.ts';
import { VerificationReport } from '../../server/auditLog.ts';
import { SelfTestReport } from '../../server/selfTest.ts';
import { OutboxEmail, RefundRecord } from '../../server/protectedTools.ts';

export async function fetchScenarios(): Promise<ScenarioDefinition[]> {
  const res = await fetch('/api/scenarios');
  if (!res.ok) throw new Error('Failed to fetch scenarios');
  const data = await res.json();
  return data.scenarios;
}

export async function runAgentScenario(params: {
  scenarioId: string;
  firewallMode: FirewallMode;
  llmMode: LLMMode;
}): Promise<Incident> {
  const res = await fetch('/api/agent/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to run scenario');
  }
  const data = await res.json();
  return data.incident;
}

export async function fetchIncidents(): Promise<Incident[]> {
  const res = await fetch('/api/incidents');
  if (!res.ok) throw new Error('Failed to fetch incidents');
  const data = await res.json();
  return data.incidents;
}

export async function fetchIncidentById(id: string): Promise<Incident> {
  const res = await fetch(`/api/incidents/${id}`);
  if (!res.ok) throw new Error('Failed to fetch incident');
  const data = await res.json();
  return data.incident;
}

export async function fetchApprovals(): Promise<{ pending: ApprovalItem[]; all: ApprovalItem[] }> {
  const res = await fetch('/api/approvals');
  if (!res.ok) throw new Error('Failed to fetch approvals');
  return res.json();
}

export async function resolveApproval(
  id: string,
  action: 'APPROVE' | 'DENY',
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`/api/approvals/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, notes }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to resolve approval');
  }
  return res.json();
}

export async function fetchPolicy(): Promise<{ policyYaml: string; taxonomy: Record<string, ToolTaxonomy> }> {
  const res = await fetch('/api/policy');
  if (!res.ok) throw new Error('Failed to fetch policy');
  return res.json();
}

export async function updatePolicy(yamlContent: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch('/api/policy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yamlContent }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update policy');
  return data;
}

export async function fetchAuditLog(): Promise<{ entries: AuditEntry[]; totalEntries: number }> {
  const res = await fetch('/api/audit');
  if (!res.ok) throw new Error('Failed to fetch audit log');
  return res.json();
}

export async function verifyAuditChain(): Promise<VerificationReport> {
  const res = await fetch('/api/audit/verify');
  if (!res.ok) throw new Error('Failed to verify audit chain');
  const data = await res.json();
  return data.report;
}

export async function simulateAuditTamper(seq: number): Promise<{ success: boolean; tamperedSeq: number }> {
  const res = await fetch('/api/audit/tamper', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seq, forgedData: { ruleId: 'R1', action: 'FORGED_ALLOW', forged: true } }),
  });
  if (!res.ok) throw new Error('Failed to simulate tamper');
  return res.json();
}

export async function resetSystemState(): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/reset', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset system state');
  return res.json();
}

export async function runSelfTests(): Promise<SelfTestReport> {
  const res = await fetch('/api/selftest');
  if (!res.ok) throw new Error('Failed to run self-tests');
  const data = await res.json();
  return data.report;
}

export async function fetchOutboxAndRefunds(): Promise<{
  outbox: OutboxEmail[];
  refunds: RefundRecord[];
}> {
  const res = await fetch('/api/tools/outbox');
  if (!res.ok) throw new Error('Failed to fetch tools status');
  return res.json();
}

export async function fetchApps(): Promise<OrgApp[]> {
  const res = await fetch('/api/apps');
  if (!res.ok) throw new Error('Failed to fetch apps');
  const data = await res.json();
  return data.apps;
}

export async function updateAppConfig(appId: string, updates: Partial<OrgApp>): Promise<OrgApp> {
  const res = await fetch(`/api/apps/${appId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update app config');
  const data = await res.json();
  return data.app;
}

export async function dryRunPolicy(params: {
  toolCall: unknown;
  segments: unknown[];
  firewallMode?: FirewallMode;
}): Promise<{ decision: GateDecision; findings: Finding[]; injectionScore: number }> {
  const res = await fetch('/api/policy/dry-run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to execute dry-run test');
  }
  return res.json();
}

export async function fetchPolicyVersions(): Promise<PolicyVersion[]> {
  const res = await fetch('/api/policy/versions');
  if (!res.ok) throw new Error('Failed to fetch policy versions');
  const data = await res.json();
  return data.versions;
}

export interface ComplianceMatrixResponse {
  disclaimer: string;
  matrix: Array<{
    id: string;
    name: string;
    status: 'Covered' | 'Partial' | 'Roadmap';
    description: string;
    mechanisms: string[];
    notes: string;
  }>;
}

export async function fetchComplianceMatrix(): Promise<ComplianceMatrixResponse> {
  const res = await fetch('/api/compliance');
  if (!res.ok) throw new Error('Failed to fetch compliance matrix');
  return res.json();
}

// --- Red-Team Runner API ---
export async function fetchRedTeamAttacks() {
  const res = await fetch('/api/redteam/attacks');
  if (!res.ok) throw new Error('Failed to fetch red-team attacks');
  return res.json();
}

export async function runRedTeamSuite(firewallMode: FirewallMode) {
  const res = await fetch('/api/redteam/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firewallMode }),
  });
  if (!res.ok) throw new Error('Failed to run red-team suite');
  return res.json();
}

export async function runAdaptiveAttack(attackId: string, maxAttempts: number = 8) {
  const res = await fetch('/api/redteam/adaptive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attackId, maxAttempts }),
  });
  if (!res.ok) throw new Error('Failed to run adaptive attack');
  return res.json();
}

export async function fetchReportHtml(report: unknown) {
  const res = await fetch('/api/redteam/report/html', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report }),
  });
  if (!res.ok) throw new Error('Failed to generate report HTML');
  return res.json();
}

// --- Attack Intelligence API ---
export async function enrichIndicator(indicator: string) {
  const res = await fetch(`/api/intel/enrich/${encodeURIComponent(indicator)}`);
  if (!res.ok) throw new Error('Failed to enrich indicator');
  return res.json();
}

export async function fetchCampaigns() {
  const res = await fetch('/api/intel/campaigns');
  if (!res.ok) throw new Error('Failed to fetch campaigns');
  return res.json();
}

export async function fetchBlocklist() {
  const res = await fetch('/api/intel/blocklist');
  if (!res.ok) throw new Error('Failed to fetch blocklist');
  return res.json();
}

export async function addBlocklistEntry(data: {
  indicator: string;
  type?: string;
  scope?: string;
  mode?: string;
  ttlHours?: number;
  appealNote?: string;
}) {
  const res = await fetch('/api/intel/blocklist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to add blocklist entry');
  return res.json();
}

export async function approveBlocklistEntry(id: string, approver?: string) {
  const res = await fetch(`/api/intel/blocklist/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approver }),
  });
  if (!res.ok) throw new Error('Failed to approve blocklist entry');
  return res.json();
}

export async function allowlistEntry(id: string) {
  const res = await fetch(`/api/intel/blocklist/${id}/allowlist`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to allowlist entry');
  return res.json();
}

export async function exportStixJson() {
  const res = await fetch('/api/intel/blocklist/export-stix');
  if (!res.ok) throw new Error('Failed to export STIX JSON');
  return res.json();
}

// --- Traffic Intelligence API ---
export async function fetchTrafficSeries(appId?: string) {
  const url = appId && appId !== 'all' ? `/api/traffic/series?appId=${appId}` : '/api/traffic/series';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch traffic series');
  return res.json();
}

export async function fetchRiskyAccounts() {
  const res = await fetch('/api/traffic/accounts');
  if (!res.ok) throw new Error('Failed to fetch risky accounts');
  return res.json();
}

export async function fetchDetectorHealth() {
  const res = await fetch('/api/traffic/detectors');
  if (!res.ok) throw new Error('Failed to fetch detector health');
  return res.json();
}

export async function markDetectorFalsePositive(detectorName: string) {
  const res = await fetch('/api/traffic/mark-fp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ detectorName }),
  });
  if (!res.ok) throw new Error('Failed to mark false positive');
  return res.json();
}

// --- AI Incident Response API ---
export async function fetchBlastRadiusGraph(incidentId: string) {
  const res = await fetch(`/api/response/blast-radius/${incidentId}`);
  if (!res.ok) throw new Error('Failed to fetch blast radius graph');
  return res.json();
}

export async function fetchKillSwitchState() {
  const res = await fetch('/api/response/kill-switch');
  if (!res.ok) throw new Error('Failed to fetch kill-switch state');
  return res.json();
}

export async function toggleKillSwitch(agentId: string, enableQuarantine: boolean, reason?: string) {
  const res = await fetch('/api/response/kill-switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, enableQuarantine, reason }),
  });
  if (!res.ok) throw new Error('Failed to toggle kill switch');
  return res.json();
}

export async function fetchReportDrafts(incidentId: string) {
  const res = await fetch(`/api/response/reports/${incidentId}`);
  if (!res.ok) throw new Error('Failed to fetch incident report drafts');
  return res.json();
}

export async function fetchTimeline(incidentId: string) {
  const res = await fetch(`/api/response/timeline/${incidentId}`);
  if (!res.ok) throw new Error('Failed to fetch incident timeline');
  return res.json();
}

// --- MCP Tool Vetting API ---
export async function fetchMcpTools() {
  const res = await fetch('/api/mcp/tools');
  if (!res.ok) throw new Error('Failed to fetch MCP tools');
  return res.json();
}

export async function simulateMcpRugPull(toolId: string) {
  const res = await fetch('/api/mcp/rug-pull', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolId }),
  });
  if (!res.ok) throw new Error('Failed to simulate MCP rug pull');
  return res.json();
}

export async function resetMcpRegistry() {
  const res = await fetch('/api/mcp/reset', {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to reset MCP registry');
  return res.json();
}
