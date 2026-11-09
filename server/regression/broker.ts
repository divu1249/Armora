import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CredentialBroker, TokenVerifier, hashArgs, TOKEN_AUDIENCE, TOKEN_TTL_SECONDS } from '../credentialBroker.ts';
import { ProtectedToolServer } from '../protectedTools.ts';
import { LegacyStandingKeyDemo, LEGACY_LABEL } from '../legacyStandingKeyDemo.ts';
import { canonicalJson, sha256Hex } from '../canonical.ts';
import { validateToolArgs } from '../toolSchemas.ts';
import { incidentResponseEngine } from '../incidentResponse.ts';
import type { ToolCall } from '../types.ts';
import { eq, makeStack, signCustom, skip, suite, yes } from './helpers.ts';

const exec = (s: ReturnType<typeof makeStack>, call: ToolCall, token: string, sessionId = 'sessA') =>
  s.toolServer.executeTool({ toolCall: call, credential: token, sessionId });
const mint = (s: ReturnType<typeof makeStack>, call: ToolCall, sessionId = 'sessA', approvalId?: string, agentId = 'agent_x') =>
  s.broker.issueToken({ sessionId, agentId, toolCall: call });
const upd = (candidateId: string, status: string): ToolCall => ({ tool: 'update_candidate_status', args: { candidateId, status } });
const mail = (to: unknown): ToolCall => ({ tool: 'send_email', args: { to, subject: 's', body: 'b' } });
const refund = (amount: unknown): ToolCall => ({ tool: 'issue_refund', args: { amount, upiId: 'a@okaxis' } });
const err = (r: { error?: string; success: boolean }) => (r.success ? 'EXECUTED' : (r.error ?? '').slice(0, 90));
const validClaims = (s: ReturnType<typeof makeStack>, call: ToolCall, over: Record<string, unknown> = {}) => {
  const now = Math.floor(s.clock.t / 1000);
  return {
    jti: `jti_${crypto.randomBytes(8).toString('hex')}`,
    sub: 'agent_x',
    sessionId: 'sessA',
    tool: call.tool,
    argsHash: hashArgs(call.args),
    iat: now,
    nbf: now,
    exp: now + 60,
    aud: TOKEN_AUDIENCE,
    ...over,
  };
};
const hdr = (s: ReturnType<typeof makeStack>) => ({ alg: 'EdDSA', typ: 'JWT', kid: s.broker.kid });

const readSrc = (rel: string): string | null => {
  const f = path.resolve(process.cwd(), rel);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
};

export const brokerCases = suite(4, 'Regression 4: Credential broker (Ed25519)', [
  // --- the five required vectors ---
  ['token for CAND_101/REJECTED used for CAND_102/HIRED => rejected', () => {
    const s = makeStack();
    const { token } = mint(s, upd('CAND_101', 'REJECTED'));
    const r = exec(s, upd('CAND_102', 'HIRED'), token);
    return yes(!r.success && /Argument hash mismatch/.test(r.error ?? ''), err(r));
  }],
  ['token minted with array `to` used for attacker@evil.com => rejected', () => {
    const s = makeStack();
    const { token } = mint(s, mail(['b@example.com']));
    const r = exec(s, mail('attacker@evil.com'), token);
    const r2 = exec(s, mail(['attacker@evil.com']), token);
    return yes(!r.success && !r2.success, `${err(r)} | ${err(r2)}`);
  }],
  ['string amount "500" cannot be minted; token for 500 used with 999999 / "999999" => rejected', () => {
    const s = makeStack();
    let minted = true;
    try { mint(s, refund('500')); } catch { minted = false; }
    const { token } = mint(s, refund(500));
    const r1 = exec(s, refund(999999), token);
    const r2 = exec(s, refund('999999'), token);
    return eq([false, false, false], [minted, r1.success, r2.success], `${err(r1)} | ${err(r2)}`);
  }],
  ['token from sessionA used in sessionB => rejected', () => {
    const s = makeStack();
    const { token } = mint(s, refund(500), 'sessA');
    const r = exec(s, refund(500), token, 'sessB');
    return yes(!r.success && /Session mismatch/.test(r.error ?? ''), err(r));
  }],
  ['token forged with any previously committed default secret => rejected', () => {
    const s = makeStack();
    const call = refund(500);
    const oldSecrets = ['dev_broker_hmac_secret_key_llm_firewall_2026', 'mk_master_standing_static_key_unbounded_privilege'];
    const out: string[] = [];
    for (const secret of oldSecrets) {
      const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const p = Buffer.from(JSON.stringify(validClaims(s, call))).toString('base64url');
      const sig = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
      out.push(err(exec(s, call, `${h}.${p}.${sig}`)));
      // also try the old secret as a bare "master key" credential
      out.push(err(exec(s, call, secret)));
    }
    // and an EdDSA-shaped token with a valid-looking header but signed by an attacker key
    const attackerSeed = crypto.randomBytes(32);
    out.push(err(exec(s, call, signCustom(attackerSeed, hdr(s), validClaims(s, call)))));
    return yes(out.every((o) => o !== 'EXECUTED'), out.join(' | '));
  }],
  // --- full rejection matrix ---
  ['valid token executes exactly once; replay is rejected', () => {
    const s = makeStack();
    const { token } = mint(s, refund(500));
    const a = exec(s, refund(500), token);
    const b = exec(s, refund(500), token);
    return yes(a.success && !b.success && /Replay attack/.test(b.error ?? ''), `${err(a)} | ${err(b)}`);
  }],
  ['bad signature (flipped byte) => rejected', () => {
    const s = makeStack();
    const { token } = mint(s, refund(500));
    const parts = token.split('.');
    const sig = Buffer.from(parts[2], 'base64url');
    sig[0] ^= 0xff;
    return yes(!exec(s, refund(500), `${parts[0]}.${parts[1]}.${sig.toString('base64url')}`).success);
  }],
  ['tampered claims (payload swapped, signature kept) => rejected', () => {
    const s = makeStack();
    const { token } = mint(s, refund(500));
    const [h, , sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify(validClaims(s, refund(500), { sessionId: 'sessB' }))).toString('base64url');
    return yes(!exec(s, refund(500), `${h}.${forged}.${sig}`, 'sessB').success);
  }],
  ['expired token => rejected', () => {
    const s = makeStack();
    const { token } = mint(s, refund(500));
    s.clock.t += 61_000;
    const r = exec(s, refund(500), token);
    return yes(!r.success && /expired/i.test(r.error ?? ''), err(r));
  }],
  ['not-yet-valid token (nbf in the future) => rejected', () => {
    const s = makeStack();
    const call = refund(500);
    const now = Math.floor(s.clock.t / 1000);
    const t = signCustom(s.seed, hdr(s), validClaims(s, call, { nbf: now + 30, iat: now, exp: now + 60 }));
    return yes(!exec(s, call, t).success);
  }],
  ['wrong audience => rejected', () => {
    const s = makeStack();
    const call = refund(500);
    const t = signCustom(s.seed, hdr(s), validClaims(s, call, { aud: 'some-other-service' }));
    const r = exec(s, call, t);
    return yes(!r.success && /audience/i.test(r.error ?? ''), err(r));
  }],
  ['wrong tool => rejected', () => {
    const s = makeStack();
    const { token } = mint(s, upd('CAND_101', 'REJECTED'));
    const r = exec(s, refund(500), token);
    return yes(!r.success && /Tool scope mismatch/.test(r.error ?? ''), err(r));
  }],
  ['lifetime longer than 60s (even if correctly signed) => rejected; issued tokens have exp-iat=60', () => {
    const s = makeStack();
    const call = refund(500);
    const now = Math.floor(s.clock.t / 1000);
    const long = signCustom(s.seed, hdr(s), validClaims(s, call, { exp: now + 3600 }));
    const { claims } = mint(s, call);
    return eq([false, TOKEN_TTL_SECONDS], [exec(s, call, long).success, claims.exp - claims.iat]);
  }],
  ['alg=none / HS256 headers are never accepted', () => {
    const s = makeStack();
    const call = refund(500);
    const p = Buffer.from(JSON.stringify(validClaims(s, call))).toString('base64url');
    const out = ['none', 'HS256'].map((alg) => {
      const h = Buffer.from(JSON.stringify({ alg, typ: 'JWT', kid: s.broker.kid })).toString('base64url');
      return exec(s, call, `${h}.${p}.AAAA`).success;
    });
    return eq([false, false], out);
  }],
  ['unknown kid => rejected', () => {
    const s = makeStack();
    const call = refund(500);
    const t = signCustom(s.seed, { alg: 'EdDSA', typ: 'JWT', kid: 'deadbeefdeadbeef' }, validClaims(s, call));
    return yes(!exec(s, call, t).success);
  }],
  ['revoked token => rejected', () => {
    const s = makeStack();
    const { token, claims } = mint(s, refund(500));
    s.broker.revokeToken(claims.jti);
    const r = exec(s, refund(500), token);
    return yes(!r.success && /revoked/.test(r.error ?? ''), err(r));
  }],
  ['kill switch revokes ALL outstanding tokens of the agent (and only that agent)', () => {
    const s = makeStack();
    const a1 = mint(s, refund(500), 'sessA', undefined, 'agent_victim');
    const a2 = mint(s, mail('b@example.com'), 'sessA', undefined, 'agent_victim');
    const other = mint(s, refund(100), 'sessA', undefined, 'agent_other');
    const n = s.broker.revokeAgent('agent_victim');
    const results = [exec(s, refund(500), a1.token).success, exec(s, mail('b@example.com'), a2.token).success, exec(s, refund(100), other.token).success];
    return eq({ n: 2, results: [false, false, true] }, { n, results });
  }],
  ['kill switch via incidentResponseEngine revokes live broker tokens', () => {
    const agent = `agent_reg_${crypto.randomBytes(3).toString('hex')}`;
    // uses the shared singleton broker on purpose: that is the wiring being verified
    return import('../credentialBroker.ts').then(({ credentialBroker }) => {
      credentialBroker.issueToken({ sessionId: 's', agentId: agent, toolCall: refund(1) });
      const before = credentialBroker.outstandingCount(agent);
      incidentResponseEngine.toggleKillSwitch(agent, true, 'regression test');
      const after = credentialBroker.outstandingCount(agent);
      incidentResponseEngine.toggleKillSwitch(agent, false, 'regression test cleanup');
      return eq([1, 0], [before, after]);
    });
  }, { live: true }],
  ['claims contain jti, sub, sessionId, tool, argsHash, approvalId, iat, nbf, exp, aud', () => {
    const s = makeStack();
    const call = refund(500);
    const { claims } = s.broker.issueToken({ sessionId: 'sessA', agentId: 'agent_x', toolCall: call, approvalId: 'appr_1' });
    const keys = Object.keys(claims).sort();
    return eq(['approvalId', 'argsHash', 'aud', 'exp', 'iat', 'jti', 'nbf', 'sessionId', 'sub', 'tool'], keys);
  }],
  ['argsHash = SHA-256 of canonical JSON of the full validated arguments (key order irrelevant)', () => {
    const s = makeStack();
    const a = s.broker.issueToken({ sessionId: 's', agentId: 'a', toolCall: { tool: 'issue_refund', args: { upiId: 'a@okaxis', amount: 5 } } });
    const expected = sha256Hex(canonicalJson({ amount: 5, upiId: 'a@okaxis' }));
    return eq(expected, a.claims.argsHash);
  }],
  ['approvalId is bound into the token and survives verification', () => {
    const s = makeStack();
    const call = refund(5000);
    const { token } = s.broker.issueToken({ sessionId: 'sessA', agentId: 'a', toolCall: call, approvalId: 'appr_42' });
    const r = exec(s, call, token);
    return yes(r.success && /approval: appr_42/.test(r.credentialInfo), r.credentialInfo);
  }],
  ['key rotation: previous key accepted for at most one token TTL', () => {
    const s = makeStack();
    const { token } = mint(s, refund(500));
    const rot = s.broker.rotateKey();
    s.clock.t += 5_000;
    const withinTtl = exec(s, refund(500), token).success;
    const keysAfter = s.broker.getVerificationKeys(s.clock.t + 61_000).map((k) => k.kid);
    const fresh = mint(s, refund(600));
    const freshOk = exec(s, refund(600), fresh.token).success;
    return eq({ withinTtl: true, freshOk: true, oldKidGone: true, newKid: true }, { withinTtl, freshOk, oldKidGone: !keysAfter.includes(rot.oldKid), newKid: keysAfter.includes(rot.newKid) });
  }],
  ['retired key is rejected after the TTL window', () => {
    const s = makeStack();
    const call = refund(500);
    const old = signCustom(s.seed, hdr(s), validClaims(s, call)); // signed with the pre-rotation key
    s.broker.rotateKey();
    s.clock.t += 61_000;
    return yes(!exec(s, call, old).success);
  }],
  ['jti store and revoked set are cleaned up after expiry', () => {
    const s = makeStack();
    const { token, claims } = mint(s, refund(500));
    exec(s, refund(500), token);
    s.broker.revokeToken(claims.jti, s.clock.t + 1000);
    s.clock.t += 200_000;
    mint(s, refund(1)); // triggers broker cleanup
    exec(s, refund(1), 'x'); // triggers verifier cleanup
    return yes(!s.broker.isRevoked(claims.jti));
  }],
  // --- argument schemas ---
  ['arg schemas: unknown/extra arguments, non-finite, non-positive and oversize values are rejected', () => {
    const bad = [
      validateToolArgs('issue_refund', { amount: 5, upiId: 'a@okaxis', extra: 1 }).ok,
      validateToolArgs('issue_refund', { amount: Infinity, upiId: 'a@okaxis' }).ok,
      validateToolArgs('issue_refund', { amount: Number.NaN, upiId: 'a@okaxis' }).ok,
      validateToolArgs('issue_refund', { amount: -1, upiId: 'a@okaxis' }).ok,
      validateToolArgs('issue_refund', { amount: 0, upiId: 'a@okaxis' }).ok,
      validateToolArgs('issue_refund', { amount: '5', upiId: 'a@okaxis' }).ok,
      validateToolArgs('send_email', { to: 'a@example.com', subject: 'x'.repeat(201), body: 'b' }).ok,
      validateToolArgs('lookup_order', { orderId: '../etc/passwd' }).ok,
      validateToolArgs('update_candidate_status', { candidateId: 'CAND_1', status: 'hired' }).ok,
      validateToolArgs('delete_everything', {}).ok,
    ];
    return eq(bad.map(() => false), bad);
  }],
  ['tool server re-validates arguments: a validly signed token cannot smuggle extra args', () => {
    const s = makeStack();
    const call = refund(500);
    const smuggled: ToolCall = { tool: 'issue_refund', args: { amount: 500, upiId: 'a@okaxis', webhook: 'https://evil' } };
    const t = signCustom(s.seed, hdr(s), validClaims(s, smuggled));
    const r = exec(s, smuggled, t);
    void call;
    return yes(!r.success && /Invalid arguments/.test(r.error ?? ''), err(r));
  }],
  ['broker refuses to mint for invalid arguments', () => {
    const s = makeStack();
    let threw = false;
    try { mint(s, { tool: 'issue_refund', args: { amount: -5, upiId: 'a@okaxis' } }); } catch { threw = true; }
    return eq(true, threw);
  }],
  // --- isolation / no hard-coded secrets ---
  ['tool server side holds no signing capability (public view only)', () => {
    const s = makeStack();
    const view = s.broker.createPublicView() as unknown as Record<string, unknown>;
    const serialised = JSON.stringify(Object.getOwnPropertyNames(s.verifier)) + JSON.stringify(Object.keys(view));
    return yes(typeof view.issueToken === 'undefined' && !/privateKey|seed/i.test(serialised), serialised);
  }],
  ['a tool server given only the public view can verify but never mint (forging with its key material fails)', () => {
    const s = makeStack();
    const publicKey = s.broker.getVerificationKeys(s.clock.t)[0].publicKey;
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    // an attacker holding only the public key cannot produce a valid signature
    const call = refund(500);
    const h = Buffer.from(JSON.stringify(hdr(s))).toString('base64url');
    const p = Buffer.from(JSON.stringify(validClaims(s, call))).toString('base64url');
    const sig = crypto.createHmac('sha256', pem).update(`${h}.${p}`).digest('base64url'); // classic alg-confusion attempt
    return yes(!exec(s, call, `${h}.${p}.${sig}`).success);
  }],
  ['real executeTool has no master-key path: the legacy key is rejected', () => {
    const s = makeStack();
    const legacy = new LegacyStandingKeyDemo();
    const r = exec(s, refund(500), legacy.presentKey());
    return yes(!r.success && s.toolServer.getRefunds().length === 0, err(r));
  }],
  ['legacy key is random per instance and works only through the labelled simulation path', () => {
    const s = makeStack();
    const a = new LegacyStandingKeyDemo();
    const b = new LegacyStandingKeyDemo();
    const ran = a.execute(refund(500), s.toolServer);
    const wrongKey = s.toolServer.executeLegacySimulation(refund(501), 'guess', (k) => a.verifyKey(k));
    return yes(a.presentKey() !== b.presentKey() && ran.success && ran.simulation === LEGACY_LABEL && !wrongKey.success, ran.credentialInfo);
  }],
  ['executeTool signature has no isFirewallOff flag and ignores smuggled flags', () => {
    const s = makeStack();
    const legacy = new LegacyStandingKeyDemo();
    const r = (s.toolServer as unknown as { executeTool: (x: unknown, ...rest: unknown[]) => { success: boolean } }).executeTool(
      { toolCall: refund(500), credential: legacy.presentKey(), sessionId: 'sessA', isFirewallOff: true },
      true
    );
    return yes(!r.success && s.toolServer.getRefunds().length === 0);
  }],
  ['no hard-coded secrets remain in server sources', () => {
    const dir = path.resolve(process.cwd(), 'server');
    if (!fs.existsSync(dir)) return skip('source not available');
    const needles = ['dev_broker_hmac_secret', 'mk_master_standing_static_key', 'dev_audit_salt_secret', 'MASTER_KEY_SECRET', 'fw_live_hr_8819_sec'];
    const files = fs.readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith('.ts') && !f.startsWith('regression'));
    const hits = files.flatMap((f) => needles.filter((n) => fs.readFileSync(path.join(dir, f), 'utf8').includes(n)).map((n) => `${f}:${n}`));
    return eq([], hits);
  }],
  ['LIMITATION (documented): the replay store is local to one tool-server process', () => {
    const s1 = makeStack();
    const call = refund(500);
    const { token } = mint(s1, call);
    const other = new ProtectedToolServer(new TokenVerifier(s1.broker.createPublicView(), s1.broker.createPublicView(), { now: () => s1.clock.t }));
    const a = exec(s1, call, token).success;
    const b = other.executeTool({ toolCall: call, credential: token, sessionId: 'sessA' }).success;
    return eq([true, true], [a, b], 'documented limitation: replay store is local to one tool-server process');
  }],
  ['source contract: protected tools run only via ExecutionService (broker token) and the legacy module only for firewall=off', () => {
    const exe = readSrc('server/executionService.ts');
    const runner = readSrc('server/agentRunner.ts');
    if (!exe || !runner) return skip('source not available');
    return yes(
      /legacy\.execute\(/.test(exe) &&
        /s\.firewallMode === 'off'/.test(exe) &&
        !/isFirewallOff|MASTER_KEY/.test(exe + runner) &&
        !/toolServer\.executeTool|protectedToolServer\.executeTool/.test(runner)
    );
  }],
]);
