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

const ADMIN_TOKEN_KEY = 'armora_admin_token';

export function getAdminToken(): string {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setAdminToken(token: string): void {
  try {
    if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** fetch wrapper: attaches the admin token (kept in sessionStorage only) to every request. */
function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('x-admin-token', token);
  return fetch(input, { ...init, headers });
}

export interface AppConfigInfo {
  demoMode: boolean;
  production: boolean;
  adminTokenRequired: boolean;
  legacyLabel: string;
  gemini: { state: string; model: string; detail: string; banner: string | null };
}

export async function fetchAppConfig(): Promise<AppConfigInfo> {
  const res = await apiFetch('/api/config');
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}

export async function fetchAuditAnchors(): Promise<{ anchors: Array<{ seq: number; headHash: string; ts: string; sig: string }>; note: string }> {
  const res = await apiFetch('/api/audit/anchors');
  if (!res.ok) throw new Error('Failed to fetch anchors');
  return res.json();
}

export async function fetchScenarios(): Promise<ScenarioDefinition[]> {
  const res = await apiFetch('/api/scenarios');
  if (!res.ok) throw new Error('Failed to fetch scenarios');
  const data = await res.json();
  return data.scenarios;
}

export async function runAgentScenario(params: {
  scenarioId: string;
  firewallMode: FirewallMode;
  llmMode: LLMMode;
}): Promise<Incident> {
  const res = await apiFetch('/api/agent/run', {
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
  const res = await apiFetch('/api/incidents');
  if (!res.ok) throw new Error('Failed to fetch incidents');
  const data = await res.json();
  return data.incidents;
}

export async function fetchIncidentById(id: string): Promise<Incident> {
  const res = await apiFetch(`/api/incidents/${id}`);
  if (!res.ok) throw new Error('Failed to fetch incident');
  const data = await res.json();
  return data.incident;
}

export async function fetchApprovals(): Promise<{ pending: ApprovalItem[]; all: ApprovalItem[] }> {
  const res = await apiFetch('/api/approvals');
  if (!res.ok) throw new Error('Failed to fetch approvals');
  return res.json();
}

export async function resolveApproval(
  id: string,
  action: 'APPROVE' | 'DENY',
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const res = await apiFetch(`/api/approvals/${id}`, {
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
  const res = await apiFetch('/api/policy');
  if (!res.ok) throw new Error('Failed to fetch policy');
  return res.json();
}

export async function updatePolicy(yamlContent: string): Promise<{ success: boolean; error?: string }> {
  const res = await apiFetch('/api/policy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yamlContent }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update policy');
  return data;
}

export async function fetchAuditLog(): Promise<{ entries: AuditEntry[]; totalEntries: number }> {
  const res = await apiFetch('/api/audit');
  if (!res.ok) throw new Error('Failed to fetch audit log');
  return res.json();
}

export async function verifyAuditChain(): Promise<VerificationReport> {
  const res = await apiFetch('/api/audit/verify');
  if (!res.ok) throw new Error('Failed to verify audit chain');
  const data = await res.json();
  return data.report;
}

export async function simulateAuditTamper(seq: number): Promise<{ success: boolean; tamperedSeq: number }> {
  const res = await apiFetch('/api/audit/tamper', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seq, forgedData: { ruleId: 'R1', action: 'FORGED_ALLOW', forged: true } }),
  });
  if (!res.ok) throw new Error('Failed to simulate tamper');
  return res.json();
}

export async function resetSystemState(): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch('/api/reset', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset system state');
  return res.json();
}

export async function runSelfTests(): Promise<SelfTestReport> {
  const res = await apiFetch('/api/selftest');
  if (!res.ok) throw new Error('Failed to run self-tests');
  const data = await res.json();
  return data.report;
}

export async function fetchOutboxAndRefunds(): Promise<{
  outbox: OutboxEmail[];
  refunds: RefundRecord[];
}> {
  const res = await apiFetch('/api/tools/outbox');
  if (!res.ok) throw new Error('Failed to fetch tools status');
  return res.json();
}

export async function fetchApps(): Promise<OrgApp[]> {
  const res = await apiFetch('/api/apps');
  if (!res.ok) throw new Error('Failed to fetch apps');
  const data = await res.json();
  return data.apps;
}

export async function updateAppConfig(appId: string, updates: Partial<OrgApp>): Promise<OrgApp> {
  const res = await apiFetch(`/api/apps/${appId}`, {
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
  sessionState?: { untrustedIngested?: boolean; privateDataAccessed?: boolean };
  policyYaml?: string;
}): Promise<{ decision: GateDecision; findings: Finding[]; injectionScore: number }> {
  const res = await apiFetch('/api/policy/dry-run', {
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
  const res = await apiFetch('/api/policy/versions');
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
  const res = await apiFetch('/api/compliance');
  if (!res.ok) throw new Error('Failed to fetch compliance matrix');
  return res.json();
}

// --- Red-Team Runner API ---
export async function fetchRedTeamAttacks() {
  const res = await apiFetch('/api/redteam/attacks');
  if (!res.ok) throw new Error('Failed to fetch red-team attacks');
  return res.json();
}

export async function runRedTeamSuite(firewallMode: FirewallMode) {
  const res = await apiFetch('/api/redteam/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firewallMode }),
  });
  if (!res.ok) throw new Error('Failed to run red-team suite');
  return res.json();
}

export async function runAdaptiveAttack(attackId: string, maxAttempts: number = 8) {
  const res = await apiFetch('/api/redteam/adaptive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attackId, maxAttempts }),
  });
  if (!res.ok) throw new Error('Failed to run adaptive attack');
  return res.json();
}

export async function fetchReportHtml(report: unknown) {
  const res = await apiFetch('/api/redteam/report/html', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report }),
  });
  if (!res.ok) throw new Error('Failed to generate report HTML');
  return res.json();
}

// --- Attack Intelligence API ---
export async function enrichIndicator(indicator: string) {
  const res = await apiFetch(`/api/intel/enrich/${encodeURIComponent(indicator)}`);
  if (!res.ok) throw new Error('Failed to enrich indicator');
  return res.json();
}

export async function fetchCampaigns() {
  const res = await apiFetch('/api/intel/campaigns');
  if (!res.ok) throw new Error('Failed to fetch campaigns');
  return res.json();
}

export async function fetchBlocklist() {
  const res = await apiFetch('/api/intel/blocklist');
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
  const res = await apiFetch('/api/intel/blocklist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to add blocklist entry');
  return res.json();
}

export async function approveBlocklistEntry(id: string, approver?: string) {
  const res = await apiFetch(`/api/intel/blocklist/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approver }),
  });
  if (!res.ok) throw new Error('Failed to approve blocklist entry');
  return res.json();
}

export async function allowlistEntry(id: string) {
  const res = await apiFetch(`/api/intel/blocklist/${id}/allowlist`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to allowlist entry');
  return res.json();
}

export async function exportStixJson() {
  const res = await apiFetch('/api/intel/blocklist/export-stix');
  if (!res.ok) throw new Error('Failed to export STIX JSON');
  return res.json();
}

// --- Traffic Intelligence API ---
export async function fetchTrafficSeries(appId?: string) {
  const url = appId && appId !== 'all' ? `/api/traffic/series?appId=${appId}` : '/api/traffic/series';
  const res = await apiFetch(url);
  if (!res.ok) throw new Error('Failed to fetch traffic series');
  return res.json();
}

export async function fetchRiskyAccounts() {
  const res = await apiFetch('/api/traffic/accounts');
  if (!res.ok) throw new Error('Failed to fetch risky accounts');
  return res.json();
}

export async function fetchDetectorHealth() {
  const res = await apiFetch('/api/traffic/detectors');
  if (!res.ok) throw new Error('Failed to fetch detector health');
  return res.json();
}

export async function markDetectorFalsePositive(detectorName: string) {
  const res = await apiFetch('/api/traffic/mark-fp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ detectorName }),
  });
  if (!res.ok) throw new Error('Failed to mark false positive');
  return res.json();
}

// --- AI Incident Response API ---
export async function fetchBlastRadiusGraph(incidentId: string) {
  const res = await apiFetch(`/api/response/blast-radius/${incidentId}`);
  if (!res.ok) throw new Error('Failed to fetch blast radius graph');
  return res.json();
}

export async function fetchKillSwitchState() {
  const res = await apiFetch('/api/response/kill-switch');
  if (!res.ok) throw new Error('Failed to fetch kill-switch state');
  return res.json();
}

export async function toggleKillSwitch(agentId: string, enableQuarantine: boolean, reason?: string) {
  const res = await apiFetch('/api/response/kill-switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, enableQuarantine, reason }),
  });
  if (!res.ok) throw new Error('Failed to toggle kill switch');
  return res.json();
}

export async function fetchReportDrafts(incidentId: string) {
  const res = await apiFetch(`/api/response/reports/${incidentId}`);
  if (!res.ok) throw new Error('Failed to fetch incident report drafts');
  return res.json();
}

export async function fetchTimeline(incidentId: string) {
  const res = await apiFetch(`/api/response/timeline/${incidentId}`);
  if (!res.ok) throw new Error('Failed to fetch incident timeline');
  return res.json();
}

// --- MCP Tool Vetting API ---
export async function fetchMcpTools() {
  const res = await apiFetch('/api/mcp/tools');
  if (!res.ok) throw new Error('Failed to fetch MCP tools');
  return res.json();
}

export async function simulateMcpRugPull(toolId: string) {
  const res = await apiFetch('/api/mcp/rug-pull', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolId }),
  });
  if (!res.ok) throw new Error('Failed to simulate MCP rug pull');
  return res.json();
}

export async function resetMcpRegistry() {
  const res = await apiFetch('/api/mcp/reset', {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to reset MCP registry');
  return res.json();
}

// ---------------------------------------------------------------- logs, evidence, credentials

export type AuditQueryParams = {
  search?: string;
  sessionId?: string;
  ruleId?: string;
  tool?: string;
  decision?: string;
  type?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

const qs = (q: Record<string, unknown>): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '' && v !== null) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export async function fetchAuditEntries(q: AuditQueryParams): Promise<{ items: AuditEntry[]; total: number; page: number; pageSize: number; verification: VerificationReport }> {
  const res = await apiFetch(`/api/audit/entries${qs(q)}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to fetch audit entries');
  return res.json();
}

export async function fetchAuditProof(seq: number): Promise<{ proof: any }> {
  const res = await apiFetch(`/api/audit/entries/${seq}/proof`);
  if (!res.ok) throw new Error('Failed to fetch proof');
  return res.json();
}

/** Downloads through fetch so the admin token header (if any) is attached. */
async function downloadBlob(url: string, filename: string): Promise<void> {
  const res = await apiFetch(url);
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function exportAudit(format: 'jsonl' | 'csv', q: AuditQueryParams): Promise<void> {
  const { page: _p, pageSize: _s, ...rest } = q;
  return downloadBlob(`/api/audit/export${qs({ ...rest, format })}`, `armora-audit.${format}`);
}

export function downloadEvidenceBundle(sessionId: string): Promise<void> {
  return downloadBlob(`/api/response/evidence/${encodeURIComponent(sessionId)}`, `armora-evidence-${sessionId}.json`);
}

export async function fetchCredentialLedger(q: Record<string, unknown>): Promise<any> {
  const res = await apiFetch(`/api/credentials/ledger${qs(q)}`);
  if (!res.ok) throw new Error('Failed to fetch credential ledger');
  return res.json();
}

export async function fetchCredentialDetail(jti: string): Promise<any> {
  const res = await apiFetch(`/api/credentials/ledger/${encodeURIComponent(jti)}`);
  if (!res.ok) throw new Error('Token not found');
  return res.json();
}

export async function fetchCredentialInventory(): Promise<any> {
  const res = await apiFetch('/api/credentials/inventory');
  if (!res.ok) throw new Error('Failed to fetch inventory');
  return res.json();
}

export async function setTokenTtl(ttlSeconds: number): Promise<{ ttlSeconds: number }> {
  const res = await apiFetch('/api/credentials/ttl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ttlSeconds }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to set TTL');
  return data;
}

export async function rotateSigningKey(): Promise<{ oldKid: string; newKid: string; note: string }> {
  const res = await apiFetch('/api/credentials/rotate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to rotate key');
  return data;
}

export async function fetchLedgerEvents(q: Record<string, unknown>): Promise<{ items: any[]; total: number }> {
  const res = await apiFetch(`/api/ledger/events${qs(q)}`);
  if (!res.ok) throw new Error('Failed to fetch ledger events');
  return res.json();
}

export async function validatePolicyYaml(yamlContent: string): Promise<{ ok: boolean; error?: string; warnings?: string[]; rules?: string[] }> {
  const res = await apiFetch('/api/policy/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ yamlContent }) });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error || 'Validation request failed' };
  return data;
}

export async function fetchEvidenceBundleJson(sessionId: string): Promise<any> {
  const res = await apiFetch(`/api/response/evidence/${encodeURIComponent(sessionId)}`);
  if (!res.ok) throw new Error('Failed to build evidence bundle');
  return res.json();
}
