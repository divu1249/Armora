/**
 * Core type definitions for LLM Firewall
 */

export type TrustLevel = 'SYSTEM' | 'USER' | 'TOOL_OUTPUT' | 'RETRIEVED_DOC' | 'UNKNOWN';

export interface Segment {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool' | 'retrieved_doc';
  content: string;
  trust: TrustLevel;
  labelSource: string; // e.g. "app-marked", "role-inferred"
}

export type DetectorCategory =
  | 'PROMPT_INJECTION'
  | 'HINGLISH_INJECTION'
  | 'PII_AADHAAR'
  | 'PII_PAN'
  | 'PII_PHONE'
  | 'PII_EMAIL'
  | 'PII_CARD'
  | 'SECRET_API_KEY'
  | 'CANARY_LEAK'
  | 'OUTPUT_EXFILTRATION';

export interface Finding {
  id: string;
  detector: string;
  category: DetectorCategory;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number; // 0 to 1
  segmentId: string;
  start: number;
  end: number;
  reason: string;
  evidenceHash: string; // SHA-256 or HMAC-SHA256, NEVER raw content
}

export type FirewallMode = 'off' | 'shadow' | 'enforce';
export type LLMMode = 'mock' | 'gemini';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ToolTaxonomy {
  readsPrivateData: boolean;
  writes: boolean;
  irreversible: boolean;
  sendsExternal: boolean;
  privilege: 'public' | 'standard' | 'confidential' | 'high' | 'critical';
}

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export type GateAction = 'allow' | 'deny' | 'approve';

export interface MatchedRule {
  ruleId: string;
  action: GateAction;
  reason: string;
}

export interface GateDecision {
  action: GateAction;
  /** Primary rule = the most restrictive matching rule (deny > approve > allow). */
  ruleId: string;
  reason: string;
  shadowWouldBlock: boolean;
  riskLevel: RiskLevel;
  requiredApprovalId?: string;
  firewallMode: FirewallMode;
  /** Every rule that matched (all enabled rules are evaluated), most restrictive first. */
  matchedRules?: MatchedRule[];
}

/** Per-session state, updated from actual tool results (never from scenario codes). */
export interface SessionState {
  sessionId: string;
  untrustedIngested: boolean;
  privateDataAccessed: boolean;
  toolCalls: Array<{ tool: string; ts: string; success: boolean; readsPrivateData: boolean }>;
  dataObjects: string[];
}

export interface ScopedTokenClaims {
  jti: string;
  /** agent id */
  sub: string;
  sessionId: string;
  tool: string;
  /** SHA-256 hex of canonical JSON of the full, validated arguments */
  argsHash: string;
  approvalId?: string;
  /** seconds since epoch */
  iat: number;
  nbf: number;
  exp: number;
  aud: string;
}

export interface AuditEntry {
  seq: number;
  ts: string;
  type: 'POLICY_DECISION' | 'TOKEN_ISSUED' | 'TOOL_INVOCATION' | 'APPROVAL_DECISION' | 'TAMPER_DEMO';
  sessionId: string;
  data: {
    ruleId?: string;
    action?: string;
    riskLevel?: RiskLevel;
    findingsCount?: number;
    evidenceHashes?: string[];
    tool?: string;
    shadowWouldBlock?: boolean;
    note?: string;
    [key: string]: unknown;
  };
  prevHash: string;
  hash: string;
}

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executedWith: 'scoped_broker_token' | 'standing_master_key';
  credentialInfo: string;
  /** Present only for the legacy-pattern simulation (firewall = OFF). */
  simulation?: string;
}

export interface ApprovalItem {
  id: string;
  sessionId: string;
  createdAt: number;
  expiresAt: number;
  scenarioId: string;
  agentId?: string;
  toolCall: ToolCall;
  argsHash?: string;
  riskLevel: RiskLevel;
  reason: string;
  ruleId: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED';
  decisionNotes?: string;
}

export interface LatencyBreakdown {
  normalizationMs: number;
  detectionMs: number;
  llmExecutionMs: number;
  policyMs: number;
  toolExecutionMs: number;
  totalMs: number;
}

export interface WithoutFirewallOutcome {
  tool: string;
  args: Record<string, unknown>;
  impact: string;
  dataExfiltrated: boolean;
  financialLoss?: string;
}

export interface Incident {
  id: string;
  timestamp: string;
  scenarioId: string;
  scenarioTitle: string;
  appId?: string;
  appName?: string;
  isSeeded?: boolean;
  firewallMode: FirewallMode;
  /** The mode that actually produced the tool call ('mock' if Gemini was requested but unavailable). */
  llmMode: LLMMode;
  requestedLlmMode?: LLMMode;
  llmFallbackReason?: string;
  segments: Segment[];
  findings: Finding[];
  decision: GateDecision;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  riskLevel: RiskLevel;
  dataLeftPremises: boolean;
  latency: LatencyBreakdown;
  notices: string[];
  withoutFirewallOutcome?: WithoutFirewallOutcome;
}

export interface OrgApp {
  id: string;
  name: string;
  description: string;
  riskScore: number; // 0-100
  status: 'ACTIVE' | 'WARNING' | 'SECURED';
  totalRequests: number;
  blockedCount: number;
  allowedTools: string[];
  apiKey: string;
  environment: 'production' | 'staging';
}

export interface PolicyVersion {
  id: string;
  version: string;
  timestamp: string;
  author: string;
  changes: string;
  yaml: string;
}

export interface AppEvent {
  type:
    | 'RUN_START'
    | 'SEGMENT_TAGGED'
    | 'FINDING_DETECTED'
    | 'POLICY_EVALUATED'
    | 'APPROVAL_QUEUED'
    | 'APPROVAL_RESOLVED'
    | 'TOOL_EXECUTED'
    | 'RUN_COMPLETE';
  timestamp: string;
  sessionId: string;
  payload: unknown;
}
