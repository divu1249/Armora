import { PolicyEngine, DEFAULT_POLICY_YAML, SEEDED_POLICY_VERSIONS, parsePolicyYaml } from '../policyEngine.ts';
import { createSessionState } from '../sessionState.ts';
import type { ToolCall } from '../types.ts';
import { eq, suite, TRUSTED, UNTRUSTED, yes } from './helpers.ts';

const ev = (pe: PolicyEngine, call: ToolCall, segments = TRUSTED, extra: Record<string, unknown> = {}) =>
  pe.evaluate({ toolCall: call, segments, findings: [], injectionScore: 0, firewallMode: 'enforce', ...extra } as never);

const rule = (id: string, enabled: boolean, extra = '') =>
  `  - id: "${id}"\n    name: "n"\n    description: "d"\n    enabled: ${enabled}\n${extra}`;
const policy = (rules: string) => `version: "1.0.0"\nname: "t"\nrules:\n${rules}`;

const refund = (amount: number, upiId: string): ToolCall => ({ tool: 'issue_refund', args: { amount, upiId } });
const mail = (to: unknown): ToolCall => ({ tool: 'send_email', args: { to, subject: 's', body: 'b' } });

export const policyCases = suite(1, 'Regression 1: Policy engine', [
  ['refund 500 to attacker@evilbank in an untrusted session => deny', () => {
    const d = ev(new PolicyEngine(), refund(500, 'attacker@evilbank'), UNTRUSTED);
    return eq('deny', d.action, `${d.ruleId} matched=${d.matchedRules?.map((m) => m.ruleId).join('+')}`);
  }],
  ['refund 50000 to attacker@evilbank in a trusted session => deny (approval must not mask the UPI violation)', () => {
    const d = ev(new PolicyEngine(), refund(50000, 'attacker@evilbank'), TRUSTED);
    return eq('deny', d.action, d.reason);
  }],
  ['email to evil.com in an untrusted session => deny (R3 beats R1 approve)', () => {
    const d = ev(new PolicyEngine(), mail('a@evil.com'), UNTRUSTED);
    return eq('deny:R3_DOMAIN_ALLOWLIST', `${d.action}:${d.ruleId}`);
  }],
  ['all matching rules are collected (not first-match)', () => {
    const d = ev(new PolicyEngine(), mail('a@evil.com'), UNTRUSTED);
    const ids = (d.matchedRules ?? []).map((m) => m.ruleId).sort();
    return eq(['R1_EXTERNAL_UNTRUSTED', 'R3_DOMAIN_ALLOWLIST'], ids);
  }],
  ['most restrictive wins: deny > approve > allow', () => {
    const d = ev(new PolicyEngine(), refund(50000, 'attacker@evilbank'), UNTRUSTED);
    const actions = (d.matchedRules ?? []).map((m) => m.action);
    return yes(d.action === 'deny' && actions.includes('approve') && actions.includes('deny'), JSON.stringify(d.matchedRules));
  }],
  ['maxRefundAmount "abc" => policy rejected, previous policy stays active', () => {
    const pe = new PolicyEngine();
    const before = pe.getPolicyYaml();
    const r = pe.setPolicyYaml(policy(rule('R4_FINANCIAL_GUARD', true, '    maxRefundAmount: "abc"\n')));
    return yes(!r.success && pe.getPolicyYaml() === before, r.error);
  }],
  ['allowedDomains as a string => policy rejected', () => {
    const r = new PolicyEngine().setPolicyYaml(policy(rule('R3_DOMAIN_ALLOWLIST', true, '    allowedDomains: "example.com"\n')));
    return yes(!r.success, r.error);
  }],
  ['empty allowedDomains array => policy rejected', () => {
    const r = new PolicyEngine().setPolicyYaml(policy(rule('R3_DOMAIN_ALLOWLIST', true, '    allowedDomains: []\n')));
    return yes(!r.success, r.error);
  }],
  ['negative / zero / infinite maxRefundAmount => policy rejected', () => {
    const outs = ['-5', '0', '.inf'].map((v) => new PolicyEngine().setPolicyYaml(policy(rule('R4_FINANCIAL_GUARD', true, `    maxRefundAmount: ${v}\n`))).success);
    return eq([false, false, false], outs);
  }],
  ['unknown rule id => policy rejected', () => {
    const r = new PolicyEngine().setPolicyYaml(policy(rule('R99_BACKDOOR', true)));
    return yes(!r.success, r.error);
  }],
  ['unknown field on a rule / at top level => policy rejected', () => {
    const a = new PolicyEngine().setPolicyYaml(policy(rule('R1', true, '    bypass: true\n')));
    const b = new PolicyEngine().setPolicyYaml(policy(rule('R1', true)) + 'extra: 1\n');
    return eq([false, false], [a.success, b.success]);
  }],
  ['non-boolean enabled / duplicate ids / invalid YAML => policy rejected', () => {
    const a = new PolicyEngine().setPolicyYaml(policy(rule('R1', true).replace('enabled: true', 'enabled: "yes"')));
    const b = new PolicyEngine().setPolicyYaml(policy(rule('R1', true) + rule('R1', true)));
    const c = new PolicyEngine().setPolicyYaml('rules: [unclosed');
    return eq([false, false, false], [a.success, b.success, c.success]);
  }],
  ['built-in and seeded policy versions all validate', () => {
    const results = [DEFAULT_POLICY_YAML, ...SEEDED_POLICY_VERSIONS.map((v) => v.yaml)].map((y) => parsePolicyYaml(y).ok);
    return eq(results.map(() => true), results);
  }],
  ['all rules disabled => behaves per flags (allow / DEFAULT_ALLOW, nothing matched)', () => {
    const ids = ['R1', 'R2_TRIFECTA', 'R3_DOMAIN_ALLOWLIST', 'R4_FINANCIAL_GUARD', 'R5_PII_REDACTION', 'R6_RISK_ADAPTIVE_GATE'];
    const pe = new PolicyEngine(policy(ids.map((i) => rule(i, false)).join('')));
    const d = ev(pe, mail('a@evil.com'), UNTRUSTED, { injectionScore: 0.99 });
    const r = ev(pe, refund(50000, 'attacker@evilbank'), UNTRUSTED);
    return eq(['allow:DEFAULT_ALLOW:0', 'allow:DEFAULT_ALLOW:0'], [d, r].map((x) => `${x.action}:${x.ruleId}:${x.matchedRules?.length}`));
  }],
  ['R1 disabled is honoured (untrusted + external to an allowed domain => allow)', () => {
    const pe = new PolicyEngine(policy(rule('R1', false) + rule('R3_DOMAIN_ALLOWLIST', true, '    allowedDomains: ["example.com"]\n')));
    return eq('allow', ev(pe, mail('b@example.com'), UNTRUSTED).action);
  }],
  ['R2 disabled is honoured (private data + untrusted + external)', () => {
    const state = createSessionState('s', UNTRUSTED);
    state.privateDataAccessed = true;
    const on = ev(new PolicyEngine(), mail('b@example.com'), UNTRUSTED, { sessionState: state });
    const off = ev(new PolicyEngine(policy(rule('R2_TRIFECTA', false))), mail('b@example.com'), UNTRUSTED, { sessionState: state });
    return eq(['deny', 'allow'], [on.action, off.action]);
  }],
  ['R6 disabled is honoured (HIGH risk irreversible tool)', () => {
    const on = ev(new PolicyEngine(), refund(500, 'a@okaxis'), TRUSTED, { injectionScore: 0.95 });
    const off = ev(new PolicyEngine(policy(rule('R6_RISK_ADAPTIVE_GATE', false))), refund(500, 'a@okaxis'), TRUSTED, { injectionScore: 0.95 });
    return eq(['deny', 'allow'], [on.action, off.action]);
  }],
  ['rules not listed in the policy are not enforced and setPolicyYaml warns about them', () => {
    const pe = new PolicyEngine();
    const r = pe.setPolicyYaml(policy(rule('R1', true)));
    return yes(r.success && (r.warnings?.length ?? 0) === 5, JSON.stringify(r.warnings));
  }],
  ['evaluation error FAILS CLOSED: deny / POLICY_ERROR, never throws, never allows', () => {
    const pe = new PolicyEngine();
    const bad: unknown[] = [
      { toolCall: null, segments: [], findings: [], injectionScore: 0, firewallMode: 'enforce' },
      { toolCall: { tool: 'send_email', args: {} }, segments: [], findings: [], injectionScore: Number.NaN, firewallMode: 'enforce' },
      { toolCall: { tool: 'send_email', args: {} }, segments: 'nope', findings: [], injectionScore: 0, firewallMode: 'enforce' },
      undefined,
    ];
    const out = bad.map((p) => {
      try {
        const d = pe.evaluate(p as never);
        return `${d.action}:${d.ruleId}`;
      } catch {
        return 'THREW';
      }
    });
    return eq(out.map(() => 'deny:POLICY_ERROR'), out);
  }],
  ['fail-closed also in shadow/off mode (POLICY_ERROR is never converted to allow)', () => {
    const pe = new PolicyEngine();
    const out = (['shadow', 'off'] as const).map((m) => pe.evaluate({ toolCall: null, firewallMode: m } as never).action);
    return eq(['deny', 'deny'], out);
  }],
  ['refund with missing/NaN amount or missing UPI handle is denied (no silent default)', () => {
    const pe = new PolicyEngine();
    const a = ev(pe, { tool: 'issue_refund', args: { upiId: 'a@okaxis' } });
    const b = ev(pe, { tool: 'issue_refund', args: { amount: Number.NaN, upiId: 'a@okaxis' } });
    const c = ev(pe, { tool: 'issue_refund', args: { amount: 10 } });
    return eq(['deny', 'deny', 'deny'], [a.action, b.action, c.action]);
  }],
  ['UPI handle must equal an allowed suffix exactly (x@evil@okaxis rejected)', () => {
    return eq('deny', ev(new PolicyEngine(), refund(10, 'x@evil@okaxis')).action);
  }],
  ['legitimate small refund to an allowed handle in a trusted session => allow', () => {
    return eq('allow', ev(new PolicyEngine(), refund(500, 'cust@okaxis')).action);
  }],
]);
