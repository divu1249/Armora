import { load } from 'js-yaml';
import { z } from 'zod';
import {
  FirewallMode,
  GateAction,
  GateDecision,
  MatchedRule,
  RiskLevel,
  Segment,
  Finding,
  SessionState,
  ToolCall,
  PolicyVersion,
} from './types.ts';
import { TOOL_TAXONOMY, UNKNOWN_TOOL_TAXONOMY } from './taxonomy.ts';
import { checkRecipientsAllowed, normalizeDomain } from './emailRecipients.ts';
import { isUntrusted } from './sessionState.ts';
import type { ArgProvenance } from './provenance.ts';

export { TOOL_TAXONOMY };

export const DEFAULT_POLICY_YAML = `
version: "1.1.0"
name: "Standard Enterprise Agent Security Policy"
rules:
  - id: "R1"
    name: "External Communication from Untrusted Context"
    description: "Requires human approval if untrusted content is present and tool sends external data; deny if risk level is HIGH."
    enabled: true

  - id: "R2_TRIFECTA"
    name: "Trifecta Guard (Private Data + Untrusted Content + External Exfil)"
    description: "Denies tool calls when the session state shows private data was actually read, untrusted content was ingested, and the tool communicates externally."
    enabled: true

  - id: "R3_DOMAIN_ALLOWLIST"
    name: "Email Recipient Domain Allow-List"
    description: "Denies email tool calls unless EVERY to/cc/bcc address is on an allowed domain (exact match)."
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

  - id: "R7_UNTRUSTED_DERIVED_ARGS"
    name: "Recipient/Payee Derived From Untrusted Content"
    description: "Irreversible or external tools whose recipient or payee text also appears in an untrusted segment (exact, normalized or base64) need human approval. A signal, not a guarantee: paraphrasing defeats text matching."
    enabled: true
`;

export const SEEDED_POLICY_VERSIONS: PolicyVersion[] = [
  {
    id: 'pol_v1_1_0',
    version: '1.1.0 (Active)',
    timestamp: '2026-11-09T00:00:00Z',
    author: 'sec-ops@enterprise.internal',
    changes: 'Added R7: recipient/payee derived from untrusted content requires approval (argument provenance). Builds on Trifecta Guard (R2), PII redaction (R5) and adaptive risk gate (R6).',
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

// ---------------------------------------------------------------------------
// Policy schema (zod). Unknown rule ids and unknown fields are rejected.
// ---------------------------------------------------------------------------

const ruleBase = {
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
  enabled: z.boolean(),
};

const domainString = z
  .string()
  .min(1)
  .max(253)
  .refine((d) => normalizeDomain(d) !== null, { message: 'must be a valid domain name' });

const upiSuffix = z.string().regex(/^@[a-z0-9]{2,32}$/i, 'must look like "@okaxis"');

const RuleSchema = z.discriminatedUnion('id', [
  z.object({ id: z.literal('R1'), ...ruleBase }).strict(),
  z.object({ id: z.literal('R2_TRIFECTA'), ...ruleBase }).strict(),
  z
    .object({
      id: z.literal('R3_DOMAIN_ALLOWLIST'),
      ...ruleBase,
      allowedDomains: z.array(domainString).min(1).max(100).optional(),
    })
    .strict(),
  z
    .object({
      id: z.literal('R4_FINANCIAL_GUARD'),
      ...ruleBase,
      maxRefundAmount: z.number().finite().positive().optional(),
      allowedUpiSuffixes: z.array(upiSuffix).min(1).max(100).optional(),
    })
    .strict(),
  z.object({ id: z.literal('R5_PII_REDACTION'), ...ruleBase }).strict(),
  z.object({ id: z.literal('R6_RISK_ADAPTIVE_GATE'), ...ruleBase }).strict(),
  z.object({ id: z.literal('R7_UNTRUSTED_DERIVED_ARGS'), ...ruleBase }).strict(),
]);

export const PolicySchema = z
  .object({
    version: z.string().min(1).max(50),
    name: z.string().min(1).max(200),
    rules: z.array(RuleSchema).min(1).max(20),
  })
  .strict()
  .superRefine((p, ctx) => {
    const seen = new Set<string>();
    p.rules.forEach((r, i) => {
      if (seen.has(r.id)) ctx.addIssue({ code: 'custom', path: ['rules', i, 'id'], message: `duplicate rule id ${r.id}` });
      seen.add(r.id);
    });
  });

export type ParsedPolicy = z.infer<typeof PolicySchema>;
export type PolicyRuleId = ParsedPolicy['rules'][number]['id'];
export const KNOWN_RULE_IDS: PolicyRuleId[] = [
  'R1',
  'R2_TRIFECTA',
  'R3_DOMAIN_ALLOWLIST',
  'R4_FINANCIAL_GUARD',
  'R5_PII_REDACTION',
  'R6_RISK_ADAPTIVE_GATE',
  'R7_UNTRUSTED_DERIVED_ARGS',
];

const MAX_POLICY_BYTES = 100_000;

export function parsePolicyYaml(
  yamlContent: unknown
): { ok: true; policy: ParsedPolicy; error?: undefined } | { ok: false; error: string; policy?: undefined } {
  if (typeof yamlContent !== 'string') return { ok: false, error: 'Policy must be a YAML string' };
  if (yamlContent.length > MAX_POLICY_BYTES) return { ok: false, error: 'Policy too large' };
  let loaded: unknown;
  try {
    loaded = load(yamlContent);
  } catch (err) {
    return { ok: false, error: `Invalid YAML: ${err instanceof Error ? err.message : String(err)}` };
  }
  const parsed = PolicySchema.safeParse(loaded);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    return { ok: false, error: `Policy validation failed: ${msg}` };
  }
  return { ok: true, policy: parsed.data };
}

/** Validation without saving (used by the policy editor for live feedback). */
export function validatePolicy(yamlContent: unknown): { ok: boolean; error?: string; warnings: string[]; rules: string[] } {
  const r = parsePolicyYaml(yamlContent);
  if (!r.ok) return { ok: false, error: r.error, warnings: [], rules: [] };
  const present = new Set(r.policy.rules.map((x) => x.id));
  return {
    ok: true,
    warnings: KNOWN_RULE_IDS.filter((id) => !present.has(id)).map((id) => `Rule ${id} is not listed in this policy and would NOT be enforced.`),
    rules: r.policy.rules.map((x) => x.id),
  };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

const SEVERITY: Record<GateAction, number> = { allow: 0, approve: 1, deny: 2 };
/** Tie-break among rules with equal restrictiveness (lower index wins). */
const PRIORITY = [
  'R6_RISK_ADAPTIVE_GATE',
  'R2_TRIFECTA',
  'R3_DOMAIN_ALLOWLIST',
  'R4_FINANCIAL_GUARD',
  'R7_UNTRUSTED_DERIVED_ARGS',
  'R1_EXTERNAL_UNTRUSTED',
];

const DEFAULT_ALLOWED_DOMAINS = ['example.com', 'company.internal'];
const DEFAULT_MAX_REFUND = 2000;
const DEFAULT_UPI_SUFFIXES = ['@okaxis', '@okhdfcbank', '@paytm', '@icici'];

interface AnyRule {
  id: string;
  enabled: boolean;
  allowedDomains?: string[];
  maxRefundAmount?: number;
  allowedUpiSuffixes?: string[];
}

export interface EvaluateParams {
  toolCall: ToolCall;
  segments: Segment[];
  findings: Finding[];
  injectionScore: number;
  firewallMode: FirewallMode;
  sessionState?: SessionState;
  /** result of findArgProvenance for this call (optional; R7 needs it) */
  argProvenance?: ArgProvenance;
}

export class PolicyEngine {
  private activePolicyYaml: string = DEFAULT_POLICY_YAML;
  private parsedPolicy: ParsedPolicy;

  constructor(yaml: string = DEFAULT_POLICY_YAML) {
    const r = parsePolicyYaml(yaml);
    if (!r.ok) throw new Error(`Built-in policy is invalid: ${r.error}`);
    this.activePolicyYaml = yaml;
    this.parsedPolicy = r.policy;
  }

  public getPolicyYaml(): string {
    return this.activePolicyYaml;
  }

  public getPolicy(): ParsedPolicy {
    return this.parsedPolicy;
  }

  /** Invalid policies are rejected; the previously active policy stays in force. */
  public setPolicyYaml(newYaml: unknown): { success: boolean; error?: string; warnings?: string[] } {
    const r = parsePolicyYaml(newYaml);
    if (!r.ok) return { success: false, error: r.error };
    this.parsedPolicy = r.policy;
    this.activePolicyYaml = newYaml as string;
    const present = new Set(r.policy.rules.map((x) => x.id));
    const warnings = KNOWN_RULE_IDS.filter((id) => !present.has(id)).map(
      (id) => `Rule ${id} is not listed in this policy and is therefore NOT enforced.`
    );
    return { success: true, warnings };
  }

  /** A rule is active only if it is listed AND enabled. */
  public isRuleEnabled(id: PolicyRuleId): boolean {
    return this.parsedPolicy.rules.some((r) => r.id === id && r.enabled);
  }

  private rule(id: PolicyRuleId): AnyRule | undefined {
    return this.parsedPolicy.rules.find((r) => r.id === id && r.enabled) as AnyRule | undefined;
  }

  /** Never throws and never allows on error: any exception becomes deny/POLICY_ERROR. */
  public evaluate(params: EvaluateParams): GateDecision {
    try {
      return this.evaluateUnsafe(params);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const reason = `Policy evaluation error (fail-closed): ${msg}`;
      return {
        action: 'deny',
        ruleId: 'POLICY_ERROR',
        reason,
        shadowWouldBlock: true,
        riskLevel: 'HIGH',
        firewallMode: (params as EvaluateParams | undefined)?.firewallMode ?? 'enforce',
        matchedRules: [{ ruleId: 'POLICY_ERROR', action: 'deny', reason }],
      };
    }
  }

  private evaluateUnsafe(params: EvaluateParams): GateDecision {
    const { toolCall, segments, findings, injectionScore, firewallMode, sessionState, argProvenance } = params;
    if (!toolCall || typeof toolCall.tool !== 'string' || !toolCall.args || typeof toolCall.args !== 'object') {
      throw new Error('malformed tool call');
    }
    if (typeof injectionScore !== 'number' || !Number.isFinite(injectionScore)) {
      throw new Error('injectionScore must be a finite number');
    }
    if (!Array.isArray(segments) || !Array.isArray(findings)) throw new Error('segments/findings must be arrays');

    const taxonomy = TOOL_TAXONOMY[toolCall.tool] ?? UNKNOWN_TOOL_TAXONOMY;

    let riskLevel: RiskLevel = 'LOW';
    const hasCritical = findings.some((f) => f.severity === 'CRITICAL');
    const hasHigh = findings.some((f) => f.severity === 'HIGH');
    if (injectionScore >= 0.8 || hasCritical) riskLevel = 'HIGH';
    else if (injectionScore >= 0.4 || hasHigh) riskLevel = 'MEDIUM';

    const hasUntrusted = segments.some(isUntrusted) || sessionState?.untrustedIngested === true;
    const privateDataAccessed = sessionState?.privateDataAccessed === true;

    const matches: MatchedRule[] = [];

    // R6: Risk-adaptive gate
    if (this.rule('R6_RISK_ADAPTIVE_GATE') && riskLevel === 'HIGH' && taxonomy.irreversible) {
      matches.push({
        ruleId: 'R6_RISK_ADAPTIVE_GATE',
        action: 'deny',
        reason: `Session risk is HIGH (score: ${injectionScore}); irreversible tool "${toolCall.tool}" is denied by Action Gate.`,
      });
    }

    // R2: Trifecta guard, reads the session state (no scenario hard-coding)
    if (this.rule('R2_TRIFECTA') && hasUntrusted && taxonomy.sendsExternal && privateDataAccessed) {
      matches.push({
        ruleId: 'R2_TRIFECTA',
        action: 'deny',
        reason: `Trifecta Guard Triggered: session state shows private data was read, untrusted content was ingested, and "${toolCall.tool}" communicates externally. Execution denied.`,
      });
    }

    // R3: email recipient allow-list
    const r3 = this.rule('R3_DOMAIN_ALLOWLIST');
    if (r3 && toolCall.tool === 'send_email') {
      const allowedDomains = r3.allowedDomains ?? DEFAULT_ALLOWED_DOMAINS;
      const check = checkRecipientsAllowed(toolCall.args, allowedDomains);
      if (!check.allowed) {
        const detail = check.error
          ? check.error
          : `recipient(s) not on the allowed domain list: ${check.disallowed.join(', ')}`;
        matches.push({
          ruleId: 'R3_DOMAIN_ALLOWLIST',
          action: 'deny',
          reason: `Email recipients rejected (${detail}). Allowed domains: ${allowedDomains.join(', ')}.`,
        });
      }
    }

    // R4: financial guard (amount -> approve, UPI handle -> deny; deny wins inside the rule)
    const r4 = this.rule('R4_FINANCIAL_GUARD');
    if (r4 && toolCall.tool === 'issue_refund') {
      const maxAmount = r4.maxRefundAmount ?? DEFAULT_MAX_REFUND;
      const suffixes = (r4.allowedUpiSuffixes ?? DEFAULT_UPI_SUFFIXES).map((s) => s.toLowerCase());
      const { amount, upiId } = toolCall.args;
      const problems: string[] = [];
      let action: GateAction = 'allow';

      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        action = 'deny';
        problems.push('refund amount is missing or not a positive finite number');
      } else if (amount > maxAmount) {
        action = 'approve';
        problems.push(`Refund amount INR ${amount} exceeds policy limit (INR ${maxAmount}). Human approval required.`);
      }

      const upi = typeof upiId === 'string' ? upiId.trim().toLowerCase() : '';
      const parts = upi.split('@');
      const handle = parts.length === 2 && parts[0] ? `@${parts[1]}` : '';
      if (!handle || !suffixes.includes(handle)) {
        action = 'deny';
        problems.push(`Target UPI ID "${upi || '(missing)'}" does not match authorized banking handles (${suffixes.join(', ')}).`);
      }
      if (action !== 'allow') {
        matches.push({ ruleId: 'R4_FINANCIAL_GUARD', action, reason: problems.join(' ') });
      }
    }

    // R7: recipient/payee text also present in untrusted content (provenance signal)
    if (
      this.rule('R7_UNTRUSTED_DERIVED_ARGS') &&
      (taxonomy.irreversible || taxonomy.sendsExternal) &&
      argProvenance?.recipientOrPayeeDerivedFromUntrusted === true
    ) {
      const m = argProvenance.matches.find((x) => x.untrusted && (x.kind === 'recipient' || x.kind === 'payee'))!;
      matches.push({
        ruleId: 'R7_UNTRUSTED_DERIVED_ARGS',
        action: 'approve',
        reason: `${m.kind} "${m.value}" (arg ${m.arg}) also appears in untrusted segment ${m.segmentId} at [${m.start}-${m.end}] (${m.method} match). Human approval required. Provenance matching is a signal, not a guarantee.`,
      });
    }

    // R1: untrusted content + external tool
    if (this.rule('R1') && hasUntrusted && taxonomy.sendsExternal) {
      matches.push(
        riskLevel === 'HIGH'
          ? {
              ruleId: 'R1_EXTERNAL_UNTRUSTED',
              action: 'deny',
              reason: `External transmission via "${toolCall.tool}" from untrusted session context is denied under HIGH risk.`,
            }
          : {
              ruleId: 'R1_EXTERNAL_UNTRUSTED',
              action: 'approve',
              reason: `Untrusted content in session calling external tool "${toolCall.tool}". Human approval required.`,
            }
      );
    }

    matches.sort(
      (a, b) =>
        SEVERITY[b.action] - SEVERITY[a.action] ||
        PRIORITY.indexOf(a.ruleId) - PRIORITY.indexOf(b.ruleId)
    );

    const primary: MatchedRule =
      matches[0] ?? { ruleId: 'DEFAULT_ALLOW', action: 'allow', reason: 'No policy restrictions triggered for tool call' };
    const shadowWouldBlock = primary.action !== 'allow';
    const extra =
      matches.length > 1 ? ` [+${matches.length - 1} more rule(s) matched: ${matches.slice(1).map((m) => m.ruleId).join(', ')}]` : '';
    const base = { ruleId: primary.ruleId, shadowWouldBlock, riskLevel, firewallMode, matchedRules: matches };

    if (firewallMode === 'off') {
      return {
        ...base,
        action: 'allow',
        reason: `[FIREWALL OFF] Gate bypassed (legacy-pattern simulation). Real policy would have: ${primary.action.toUpperCase()} (${primary.reason})${extra}`,
      };
    }
    if (firewallMode === 'shadow') {
      return {
        ...base,
        action: 'allow',
        reason: `[SHADOW MODE] Execution allowed. Gate would have: ${primary.action.toUpperCase()} (${primary.reason})${extra}`,
      };
    }
    return { ...base, action: primary.action, reason: primary.reason + extra };
  }
}

export const policyEngine = new PolicyEngine();
