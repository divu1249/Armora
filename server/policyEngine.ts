import { load } from 'js-yaml';
import {
  FirewallMode,
  GateDecision,
  RiskLevel,
  Segment,
  Finding,
  ToolCall,
  ToolTaxonomy,
  PolicyVersion,
} from './types.ts';

export const TOOL_TAXONOMY: Record<string, ToolTaxonomy> = {
  read_candidate_files: {
    readsPrivateData: true,
    writes: false,
    irreversible: false,
    sendsExternal: false,
    privilege: 'confidential',
  },
  send_email: {
    readsPrivateData: false,
    writes: true,
    irreversible: true,
    sendsExternal: true,
    privilege: 'high',
  },
  update_candidate_status: {
    readsPrivateData: false,
    writes: true,
    irreversible: false,
    sendsExternal: false,
    privilege: 'standard',
  },
  lookup_order: {
    readsPrivateData: true,
    writes: false,
    irreversible: false,
    sendsExternal: false,
    privilege: 'standard',
  },
  issue_refund: {
    readsPrivateData: false,
    writes: true,
    irreversible: true,
    sendsExternal: true,
    privilege: 'critical',
  },
};

export const DEFAULT_POLICY_YAML = `
version: "1.0.0"
name: "Standard Enterprise Agent Security Policy"
rules:
  - id: "R1"
    name: "External Communication from Untrusted Context"
    description: "Requires human approval if untrusted content is present and tool sends external data; deny if risk level is HIGH."
    enabled: true

  - id: "R2_TRIFECTA"
    name: "Trifecta Guard (Private Data + Untrusted Content + External Exfil)"
    description: "Denies tool calls when session combines private data access, untrusted content, and external communication, unless explicitly approved."
    enabled: true

  - id: "R3_DOMAIN_ALLOWLIST"
    name: "Email Recipient Domain Allow-List"
    description: "Denies email tool calls to unauthorized domains outside example.com or company.internal."
    enabled: true
    allowedDomains:
      - "example.com"
      - "company.internal"
      - "authorized-partner.org"

  - id: "R4_FINANCIAL_GUARD"
    name: "Refund Threshold & UPI-ID Verification"
    description: "Restricts refunds exceeding INR 2000 or targeting unverified UPI handles."
    enabled: true
    maxRefundAmount: 2000
    allowedUpiSuffixes:
      - "@okaxis"
      - "@okhdfcbank"
      - "@paytm"
      - "@icici"

  - id: "R5_PII_REDACTION"
    name: "Outbound PII Protection"
    description: "Enforces automatic redaction of high-severity PII (Aadhaar, Card, PAN) before passing to external tools."
    enabled: true

  - id: "R6_RISK_ADAPTIVE_GATE"
    name: "Risk-Adaptive Action Gate"
    description: "Injection score >= 0.8 elevates session risk to HIGH, strictly blocking all irreversible tool calls."
    enabled: true
`;

export const SEEDED_POLICY_VERSIONS: PolicyVersion[] = [
  {
    id: 'pol_v1_0_0',
    version: '1.0.0 (Active)',
    timestamp: '2026-11-08T00:00:00Z',
    author: 'sec-ops@enterprise.internal',
    changes: 'Added Trifecta Guard (R2), outbound PII redaction (R5), and adaptive risk gate (R6).',
    yaml: DEFAULT_POLICY_YAML,
  },
  {
    id: 'pol_v0_9_0',
    version: '0.9.0 (Legacy)',
    timestamp: '2026-10-15T12:00:00Z',
    author: 'dev-lead@enterprise.internal',
    changes: 'Initial draft policy with basic domain allowlist and threshold checks.',
    yaml: `version: "0.9.0"
name: "Legacy Base Policy"
rules:
  - id: "R1"
    name: "External Communication from Untrusted Context"
    description: "Requires human approval if untrusted content is present and tool sends external data."
    enabled: true

  - id: "R3_DOMAIN_ALLOWLIST"
    name: "Email Recipient Domain Allow-List"
    description: "Denies email tool calls to unauthorized domains."
    enabled: true
    allowedDomains:
      - "example.com"
      - "company.internal"
`,
  },
  {
    id: 'pol_v1_1_0_rc',
    version: '1.1.0-RC (Strict)',
    timestamp: '2026-11-07T18:30:00Z',
    author: 'compliance-auditor@enterprise.internal',
    changes: 'Lowered refund threshold to INR 1000 and added strict banking handle constraints.',
    yaml: `version: "1.1.0-RC"
name: "Strict Hardened Agent Policy"
rules:
  - id: "R1"
    name: "External Communication from Untrusted Context"
    description: "Strictly blocks external tool calls from untrusted context without approval exception."
    enabled: true

  - id: "R2_TRIFECTA"
    name: "Trifecta Guard (Strict)"
    description: "Immediate denial whenever private data is read alongside untrusted input."
    enabled: true

  - id: "R4_FINANCIAL_GUARD"
    name: "Refund Threshold Strict"
    description: "Hard cap at INR 1000."
    enabled: true
    maxRefundAmount: 1000
    allowedUpiSuffixes:
      - "@okhdfcbank"
      - "@icici"
`,
  },
];

export interface ParsedPolicy {
  version: string;
  name: string;
  rules: Array<{
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    allowedDomains?: string[];
    maxRefundAmount?: number;
    allowedUpiSuffixes?: string[];
  }>;
}

export class PolicyEngine {
  private activePolicyYaml: string = DEFAULT_POLICY_YAML;
  private parsedPolicy: ParsedPolicy;

  constructor() {
    this.parsedPolicy = this.parseAndValidate(this.activePolicyYaml);
  }

  public getPolicyYaml(): string {
    return this.activePolicyYaml;
  }

  public setPolicyYaml(newYaml: string): { success: boolean; error?: string } {
    try {
      this.parsedPolicy = this.parseAndValidate(newYaml);
      this.activePolicyYaml = newYaml;
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  private parseAndValidate(yamlContent: string): ParsedPolicy {
    const loaded = load(yamlContent) as ParsedPolicy;
    if (!loaded || typeof loaded !== 'object') {
      throw new Error('Invalid YAML format: expected an object');
    }
    if (!loaded.version || !loaded.rules || !Array.isArray(loaded.rules)) {
      throw new Error('Policy must declare "version" and a "rules" array');
    }
    return loaded;
  }

  /**
   * Evaluates a proposed tool call within the session context.
   */
  public evaluate(params: {
    toolCall: ToolCall;
    segments: Segment[];
    findings: Finding[];
    injectionScore: number;
    firewallMode: FirewallMode;
    accessedPrivateData?: boolean;
  }): GateDecision {
    const { toolCall, segments, findings, injectionScore, firewallMode, accessedPrivateData } = params;

    const taxonomy = TOOL_TAXONOMY[toolCall.tool] || {
      readsPrivateData: false,
      writes: true,
      irreversible: true,
      sendsExternal: true,
      privilege: 'critical',
    };

    // Calculate session risk level: Risk-adaptive gating
    let riskLevel: RiskLevel = 'LOW';
    const hasCriticalFinding = findings.some((f) => f.severity === 'CRITICAL');
    const hasHighFinding = findings.some((f) => f.severity === 'HIGH');

    if (injectionScore >= 0.8 || hasCriticalFinding) {
      riskLevel = 'HIGH';
    } else if (injectionScore >= 0.4 || hasHighFinding) {
      riskLevel = 'MEDIUM';
    }

    // Determine untrusted content presence
    // UNTRUSTED = TOOL_OUTPUT, RETRIEVED_DOC, UNKNOWN
    const hasUntrustedSegments = segments.some(
      (s) => s.trust === 'TOOL_OUTPUT' || s.trust === 'RETRIEVED_DOC' || s.trust === 'UNKNOWN'
    );

    let rawDecision: { action: 'allow' | 'deny' | 'approve'; ruleId: string; reason: string } = {
      action: 'allow',
      ruleId: 'DEFAULT_ALLOW',
      reason: 'No policy restrictions triggered for tool call',
    };

    // Rule R6: Risk-Adaptive Gate: If risk level is HIGH and tool is irreversible, deny.
    if (riskLevel === 'HIGH' && taxonomy.irreversible) {
      rawDecision = {
        action: 'deny',
        ruleId: 'R6_RISK_ADAPTIVE_GATE',
        reason: `Session risk is HIGH (score: ${injectionScore}); irreversible tool "${toolCall.tool}" is denied by Action Gate.`,
      };
    }

    // Rule R2: Trifecta Guard
    // Private data access + untrusted content + external communication in one session
    else if (hasUntrustedSegments && taxonomy.sendsExternal && (accessedPrivateData || taxonomy.readsPrivateData)) {
      rawDecision = {
        action: 'deny',
        ruleId: 'R2_TRIFECTA',
        reason: `Trifecta Guard Triggered: Session combines private data access, untrusted content, and external tool "${toolCall.tool}". Execution denied.`,
      };
    }

    // Rule R1: Untrusted content + sendsExternal => require approval (deny if HIGH risk)
    else if (hasUntrustedSegments && taxonomy.sendsExternal) {
      if (riskLevel === 'HIGH') {
        rawDecision = {
          action: 'deny',
          ruleId: 'R1_EXTERNAL_UNTRUSTED',
          reason: `External transmission via "${toolCall.tool}" from untrusted session context is denied under HIGH risk.`,
        };
      } else {
        rawDecision = {
          action: 'approve',
          ruleId: 'R1_EXTERNAL_UNTRUSTED',
          reason: `Untrusted content in session calling external tool "${toolCall.tool}". Human approval required.`,
        };
      }
    }

    // Rule R3: Domain allow-list check for email
    else if (toolCall.tool === 'send_email') {
      const recipient = String(toolCall.args.to || toolCall.args.recipient || '').toLowerCase();
      const r3 = this.parsedPolicy.rules.find((r) => r.id === 'R3_DOMAIN_ALLOWLIST');
      const allowedDomains = r3?.allowedDomains || ['example.com', 'company.internal'];
      const domainMatch = allowedDomains.some((d) => recipient.endsWith(`@${d}`));

      if (!domainMatch && recipient) {
        rawDecision = {
          action: 'deny',
          ruleId: 'R3_DOMAIN_ALLOWLIST',
          reason: `Recipient email "${recipient}" is not on the allowed domain list (${allowedDomains.join(', ')}).`,
        };
      }
    }

    // Rule R4: Financial limits for issue_refund
    else if (toolCall.tool === 'issue_refund') {
      const amount = Number(toolCall.args.amount || 0);
      const upiId = String(toolCall.args.upiId || toolCall.args.upi || '').toLowerCase();
      const r4 = this.parsedPolicy.rules.find((r) => r.id === 'R4_FINANCIAL_GUARD');
      const maxAmount = r4?.maxRefundAmount ?? 2000;
      const allowedSuffixes = r4?.allowedUpiSuffixes || ['@okaxis', '@okhdfcbank', '@paytm', '@icici'];

      if (amount > maxAmount) {
        rawDecision = {
          action: 'approve',
          ruleId: 'R4_FINANCIAL_GUARD',
          reason: `Refund amount INR ${amount} exceeds policy limit (INR ${maxAmount}). Human approval required.`,
        };
      } else if (upiId && !allowedSuffixes.some((sfx) => upiId.endsWith(sfx))) {
        rawDecision = {
          action: 'deny',
          ruleId: 'R4_FINANCIAL_GUARD',
          reason: `Target UPI ID "${upiId}" does not match authorized banking handles (${allowedSuffixes.join(', ')}).`,
        };
      }
    }

    // Apply Firewall Mode logic:
    // OFF: always allows execution, noting that firewall was bypassed
    // SHADOW: logs what would be blocked, but allows execution
    // ENFORCE: strictly enforces decision
    const shadowWouldBlock = rawDecision.action !== 'allow';

    if (firewallMode === 'off') {
      return {
        action: 'allow',
        ruleId: rawDecision.ruleId,
        reason: `[FIREWALL OFF] Master Key bypass. Real policy would have: ${rawDecision.action.toUpperCase()} (${rawDecision.reason})`,
        shadowWouldBlock,
        riskLevel,
        firewallMode,
      };
    }

    if (firewallMode === 'shadow') {
      return {
        action: 'allow',
        ruleId: rawDecision.ruleId,
        reason: `[SHADOW MODE] Execution allowed. Gate would have: ${rawDecision.action.toUpperCase()} (${rawDecision.reason})`,
        shadowWouldBlock,
        riskLevel,
        firewallMode,
      };
    }

    // ENFORCE MODE
    return {
      action: rawDecision.action,
      ruleId: rawDecision.ruleId,
      reason: rawDecision.reason,
      shadowWouldBlock,
      riskLevel,
      firewallMode,
    };
  }
}

export const policyEngine = new PolicyEngine();
