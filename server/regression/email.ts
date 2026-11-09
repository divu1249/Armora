import { PolicyEngine } from '../policyEngine.ts';
import { checkRecipientsAllowed } from '../emailRecipients.ts';
import { validateToolArgs } from '../toolSchemas.ts';
import { eq, suite, TRUSTED, yes } from './helpers.ts';

const ALLOWED = ['example.com', 'company.internal'];
const denied = (args: Record<string, unknown>) => !checkRecipientsAllowed(args, ALLOWED).allowed;

export const emailCases = suite(2, 'Regression 2: Email recipient check', [
  ['"a@evil.com,b@example.com" is denied', () => yes(denied({ to: 'a@evil.com,b@example.com' }))],
  ['["a@evil.com","b@example.com"] is denied', () => yes(denied({ to: ['a@evil.com', 'b@example.com'] }))],
  ['to=b@example.com with bcc=a@evil.com is denied', () => yes(denied({ to: 'b@example.com', bcc: 'a@evil.com' }))],
  ['cc smuggling is denied', () => yes(denied({ to: 'b@example.com', cc: ['c@example.com', 'a@evil.com'] }))],
  ['x@example.com.evil.com is denied (exact domain match, not endsWith)', () => yes(denied({ to: 'x@example.com.evil.com' }))],
  ['evilexample.com / subdomain sub.example.com are denied (exact match)', () => yes(denied({ to: 'x@evilexample.com' }) && denied({ to: 'x@sub.example.com' }))],
  ['display-name trick "evil@evil.com <b@example.com>" is denied', () => yes(denied({ to: 'evil@evil.com <b@example.com>' }))],
  ['quoted display-name trick "\\"evil@evil.com\\" <b@example.com>" is denied', () => yes(denied({ to: '"evil@evil.com" <b@example.com>' }))],
  ['punycode lookalike (Cyrillic а) is denied', () => yes(denied({ to: 'ops@ex\u0430mple.com' }))],
  ['explicit xn-- lookalike is denied', () => yes(denied({ to: 'ops@xn--exmple-4nf.com' }))],
  ['malformed input is rejected (no recipient / empty / garbage / non-string)', () => {
    const out = [{}, { to: '' }, { to: [] }, { to: 'not an email' }, { to: 'a@' }, { to: '@example.com' }, { to: 42 }, { to: ['ok@example.com', 7] }].map((a) => denied(a as never));
    return eq(out.map(() => true), out);
  }],
  ['address lists are normalised: case-insensitive and display names stripped', () => {
    const r = checkRecipientsAllowed({ to: 'Bob Smith <B@EXAMPLE.COM>', cc: ['LEAD@Company.Internal'] }, ALLOWED);
    return eq({ allowed: true, addresses: ['b@example.com', 'lead@company.internal'] }, { allowed: r.allowed, addresses: r.addresses });
  }],
  ['every address on an allowed domain across to/cc/bcc => allowed', () => {
    return yes(checkRecipientsAllowed({ to: ['a@example.com', 'b@company.internal'], cc: 'c@example.com', bcc: ['d@example.com'] }, ALLOWED).allowed);
  }],
  ['policy R3 applies the same check (trusted session, bcc smuggling => deny)', () => {
    const d = new PolicyEngine().evaluate({
      toolCall: { tool: 'send_email', args: { to: 'b@example.com', bcc: 'a@evil.com', subject: 's', body: 'b' } },
      segments: TRUSTED,
      findings: [],
      injectionScore: 0,
      firewallMode: 'enforce',
    });
    return eq('deny:R3_DOMAIN_ALLOWLIST', `${d.action}:${d.ruleId}`);
  }],
  ['tool schema accepts string or array recipients and rejects unknown extra fields', () => {
    const base = { subject: 's', body: 'b' };
    const ok1 = validateToolArgs('send_email', { to: 'a@example.com', ...base }).ok;
    const ok2 = validateToolArgs('send_email', { to: ['a@example.com'], cc: 'b@example.com', ...base }).ok;
    const bad = validateToolArgs('send_email', { to: 'a@example.com', replyTo: 'x@evil.com', ...base }).ok;
    return eq([true, true, false], [ok1, ok2, bad]);
  }],
]);
