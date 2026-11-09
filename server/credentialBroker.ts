import crypto from 'node:crypto';
import { z } from 'zod';
import { canonicalJson, safeEqual, sha256Hex } from './canonical.ts';
import { validateToolArgs } from './toolSchemas.ts';
import type { ScopedTokenClaims, ToolCall } from './types.ts';

/**
 * Credential broker (Ed25519).
 *  - The broker holds the PRIVATE key and is the only component that can mint tokens.
 *  - The tool server gets a PublicKeyRegistry + RevocationList view (public keys only),
 *    so it can verify but never mint.
 *  - No secret is hard-coded: the signing seed is BROKER_ED25519_SEED (base64, 32 bytes)
 *    or crypto.randomBytes(32) generated at boot (with a warning).
 */

/** Default token lifetime. Operators may raise it (TOKEN_TTL_SECONDS / setTtl) but never above the hard cap. */
export const TOKEN_TTL_SECONDS = 60;
export const MAX_TOKEN_TTL_SECONDS = 120;

/** Receives credential lifecycle events (wired to the event ledger). Never receives token strings. */
export interface CredentialObserver {
  onIssued?(claims: ScopedTokenClaims, ttlSeconds: number): void;
  onRedeemed?(claims: ScopedTokenClaims): void;
  onRejected?(info: { code: string; error: string; tool: string; sessionId: string; claims?: ScopedTokenClaims }): void;
  onRevoked?(info: { jti: string; sub: string; sessionId?: string; tool?: string; reason: string }): void;
  onExpired?(info: { jti: string; sub: string; sessionId: string; tool: string }): void;
  onKeyRotated?(info: { oldKid: string; newKid: string }): void;
}
export const TOKEN_AUDIENCE = 'protected-tool-server';

export interface PublicKeyEntry {
  kid: string;
  publicKey: crypto.KeyObject;
  /** ms epoch after which this (retired) key is no longer accepted */
  notAfterMs?: number;
}
export interface PublicKeyRegistry {
  getVerificationKeys(nowMs: number): PublicKeyEntry[];
}
export interface RevocationList {
  isRevoked(jti: string): boolean;
}

// PKCS#8 DER prefix for an Ed25519 private key; the 32-byte seed follows.
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

function keyPairFromSeed(seed: Buffer): { privateKey: crypto.KeyObject; publicKey: crypto.KeyObject; kid: string } {
  if (seed.length !== 32) throw new Error('Ed25519 seed must be exactly 32 bytes');
  const privateKey = crypto.createPrivateKey({ key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]), format: 'der', type: 'pkcs8' });
  const publicKey = crypto.createPublicKey(privateKey);
  const spki = publicKey.export({ format: 'der', type: 'spki' }) as Buffer;
  return { privateKey, publicKey, kid: sha256Hex(spki).slice(0, 16) };
}

const ClaimsSchema = z
  .object({
    jti: z.string().min(8).max(100),
    sub: z.string().min(1).max(200),
    sessionId: z.string().min(1).max(200),
    tool: z.string().min(1).max(100),
    argsHash: z.string().regex(/^[0-9a-f]{64}$/),
    approvalId: z.string().min(1).max(200).optional(),
    iat: z.number().int(),
    nbf: z.number().int(),
    exp: z.number().int(),
    aud: z.string().min(1).max(200),
  })
  .strict();

const HeaderSchema = z.object({ alg: z.literal('EdDSA'), typ: z.literal('JWT'), kid: z.string().min(1).max(64) }).strict();

export function hashArgs(args: Record<string, unknown>): string {
  return sha256Hex(canonicalJson(args));
}

export interface BrokerOptions {
  seed?: Buffer;
  ttlSeconds?: number;
  observer?: CredentialObserver;
  now?: () => number;
  /** suppress the "random key generated" warning (tests, isolated red-team stacks) */
  quiet?: boolean;
}

export class CredentialBroker {
  private current: { privateKey: crypto.KeyObject; publicKey: crypto.KeyObject; kid: string };
  private previous?: { publicKey: crypto.KeyObject; kid: string; notAfterMs: number };
  /** jti -> { sub, expMs } for tokens that are still live (used by kill switch) */
  private outstanding = new Map<string, { sub: string; sessionId: string; tool: string; expMs: number }>();
  private ttlSeconds = TOKEN_TTL_SECONDS;
  public observer?: CredentialObserver;
  /** revoked-jti set, entries expire with the token */
  private revoked = new Map<string, number>();
  private now: () => number;

  constructor(opts: BrokerOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.observer = opts.observer;
    const envTtl = Number(process.env.TOKEN_TTL_SECONDS);
    this.ttlSeconds = opts.ttlSeconds ?? (Number.isInteger(envTtl) && envTtl >= 1 && envTtl <= MAX_TOKEN_TTL_SECONDS ? envTtl : TOKEN_TTL_SECONDS);
    let seed = opts.seed;
    if (!seed) {
      const env = process.env.BROKER_ED25519_SEED;
      if (env) {
        seed = Buffer.from(env, 'base64');
      } else {
        seed = crypto.randomBytes(32);
        if (!opts.quiet) {
          console.warn(
            '[credentialBroker] BROKER_ED25519_SEED not set: generated an ephemeral Ed25519 key with crypto.randomBytes(32). Tokens will not survive a restart.'
          );
        }
      }
    }
    this.current = keyPairFromSeed(seed);
  }

  public get kid(): string {
    return this.current.kid;
  }

  public getTtlSeconds(): number {
    return this.ttlSeconds;
  }

  /** Configure the lifetime of NEWLY issued tokens: integer 1..120 seconds. */
  public setTtl(seconds: number): number {
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > MAX_TOKEN_TTL_SECONDS) {
      throw new Error(`TTL must be an integer between 1 and ${MAX_TOKEN_TTL_SECONDS} seconds`);
    }
    this.ttlSeconds = seconds;
    return seconds;
  }

  /** Rotate the signing key. The previous PUBLIC key is accepted for at most one token TTL. */
  public rotateKey(seed: Buffer = crypto.randomBytes(32)): { oldKid: string; newKid: string } {
    const oldKid = this.current.kid;
    this.previous = {
      publicKey: this.current.publicKey,
      kid: oldKid,
      notAfterMs: this.now() + Math.max(this.ttlSeconds, TOKEN_TTL_SECONDS) * 1000,
    };
    this.current = keyPairFromSeed(seed);
    this.observer?.onKeyRotated?.({ oldKid, newKid: this.current.kid });
    return { oldKid, newKid: this.current.kid };
  }

  public getVerificationKeys(nowMs: number): PublicKeyEntry[] {
    const keys: PublicKeyEntry[] = [{ kid: this.current.kid, publicKey: this.current.publicKey }];
    if (this.previous && nowMs <= this.previous.notAfterMs) {
      keys.push({ kid: this.previous.kid, publicKey: this.previous.publicKey, notAfterMs: this.previous.notAfterMs });
    } else if (this.previous) {
      this.previous = undefined;
    }
    return keys;
  }

  /** What the tool server receives: public keys + revocation lookups only. No signing capability. */
  public createPublicView(): PublicKeyRegistry & RevocationList {
    return {
      getVerificationKeys: (nowMs: number) => this.getVerificationKeys(nowMs),
      isRevoked: (jti: string) => this.isRevoked(jti),
    };
  }

  private cleanup(nowMs: number): void {
    for (const [jti, expMs] of this.revoked) if (expMs < nowMs - 5000) this.revoked.delete(jti);
    this.sweepExpired(nowMs);
  }

  /** Tokens that reached their expiry without being redeemed or revoked are recorded as EXPIRED once. */
  public sweepExpired(nowMs: number = this.now()): number {
    let n = 0;
    for (const [jti, v] of this.outstanding) {
      if (v.expMs < nowMs) {
        this.outstanding.delete(jti);
        this.observer?.onExpired?.({ jti, sub: v.sub, sessionId: v.sessionId, tool: v.tool });
        n++;
      }
    }
    return n;
  }

  /** The tool server reports a successful redemption (no signing capability is conveyed). */
  public markRedeemed(jti: string): void {
    this.outstanding.delete(jti);
  }

  /**
   * Mint a token valid ONLY for exactly this call: tool + session + SHA-256 of the full validated args.
   * `approvalId` must be supplied when the gate required human approval.
   */
  public issueToken(params: {
    sessionId: string;
    agentId: string;
    toolCall: ToolCall;
    approvalId?: string;
  }): { token: string; claims: ScopedTokenClaims } {
    const v = validateToolArgs(params.toolCall.tool, params.toolCall.args);
    if (!v.ok) throw new Error(`Refusing to mint token: ${v.error}`);

    const nowMs = this.now();
    this.cleanup(nowMs);
    const iat = Math.floor(nowMs / 1000);
    const claims: ScopedTokenClaims = {
      jti: `jti_${crypto.randomBytes(16).toString('hex')}`,
      sub: params.agentId,
      sessionId: params.sessionId,
      tool: params.toolCall.tool,
      argsHash: hashArgs(v.args),
      ...(params.approvalId ? { approvalId: params.approvalId } : {}),
      iat,
      nbf: iat,
      exp: iat + this.ttlSeconds,
      aud: TOKEN_AUDIENCE,
    };
    const header = { alg: 'EdDSA', typ: 'JWT', kid: this.current.kid };
    const h = Buffer.from(JSON.stringify(header)).toString('base64url');
    const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const sig = crypto.sign(null, Buffer.from(`${h}.${p}`), this.current.privateKey).toString('base64url');
    this.outstanding.set(claims.jti, { sub: claims.sub, sessionId: claims.sessionId, tool: claims.tool, expMs: claims.exp * 1000 });
    this.observer?.onIssued?.(claims, this.ttlSeconds);
    return { token: `${h}.${p}.${sig}`, claims };
  }

  public revokeToken(jti: string, expMs?: number, reason = 'revoked by operator'): void {
    const known = this.outstanding.get(jti);
    this.revoked.set(jti, expMs ?? this.now() + MAX_TOKEN_TTL_SECONDS * 1000);
    this.outstanding.delete(jti);
    this.observer?.onRevoked?.({ jti, sub: known?.sub ?? 'unknown', sessionId: known?.sessionId, tool: known?.tool, reason });
  }

  /** Kill switch: revoke every outstanding token of the agent. Returns the number revoked. */
  public revokeAgent(agentId: string, reason = 'kill switch'): number {
    this.cleanup(this.now());
    let n = 0;
    for (const [jti, v] of Array.from(this.outstanding)) {
      if (v.sub === agentId) {
        this.revoked.set(jti, v.expMs);
        this.outstanding.delete(jti);
        this.observer?.onRevoked?.({ jti, sub: v.sub, sessionId: v.sessionId, tool: v.tool, reason });
        n++;
      }
    }
    return n;
  }

  public isRevoked(jti: string): boolean {
    return this.revoked.has(jti);
  }

  public outstandingCount(agentId?: string): number {
    this.cleanup(this.now());
    return Array.from(this.outstanding.values()).filter((v) => !agentId || v.sub === agentId).length;
  }

  public reset(): void {
    this.outstanding.clear();
    this.revoked.clear();
  }
}

export type VerifyCode =
  | 'MALFORMED'
  | 'BAD_HEADER'
  | 'UNKNOWN_KID'
  | 'BAD_SIGNATURE'
  | 'BAD_CLAIMS'
  | 'BAD_AUDIENCE'
  | 'NOT_YET_VALID'
  | 'EXPIRED'
  | 'BAD_LIFETIME'
  | 'REVOKED'
  | 'WRONG_TOOL'
  | 'WRONG_SESSION'
  | 'INVALID_ARGS'
  | 'ARGS_MISMATCH'
  | 'REPLAY';

export interface TokenVerificationResult {
  valid: boolean;
  claims?: ScopedTokenClaims;
  error?: string;
  code?: VerifyCode;
}

/**
 * Lives on the tool-server side. Holds only public keys, a revocation lookup,
 * and the single-use jti store (with expiry cleanup).
 */
export class TokenVerifier {
  private seen = new Map<string, number>(); // jti -> expMs
  private now: () => number;

  public observer?: CredentialObserver;

  constructor(
    private registry: PublicKeyRegistry,
    private revocations: RevocationList,
    opts: { now?: () => number; observer?: CredentialObserver } = {}
  ) {
    this.now = opts.now ?? Date.now;
    this.observer = opts.observer;
  }

  private fail(code: VerifyCode, error: string): TokenVerificationResult {
    return { valid: false, code, error };
  }

  /** Verifies and reports the outcome (accepted / rejected with reason) to the observer. */
  public verify(token: unknown, req: { tool: string; sessionId: string; args: Record<string, unknown> }): TokenVerificationResult {
    const seen: { claims?: ScopedTokenClaims } = {};
    const result = this.verifyInner(token, req, seen);
    if (result.valid && result.claims) this.observer?.onRedeemed?.(result.claims);
    else this.observer?.onRejected?.({ code: result.code ?? 'UNKNOWN', error: result.error ?? 'rejected', tool: String(req.tool).slice(0, 60), sessionId: String(req.sessionId).slice(0, 100), claims: seen.claims });
    return result;
  }

  private verifyInner(
    token: unknown,
    req: { tool: string; sessionId: string; args: Record<string, unknown> },
    seenOut: { claims?: ScopedTokenClaims }
  ): TokenVerificationResult {
    const nowMs = this.now();
    for (const [jti, expMs] of this.seen) if (expMs < nowMs - 5000) this.seen.delete(jti);

    if (typeof token !== 'string' || token.length > 4096) return this.fail('MALFORMED', 'Malformed or missing broker token');
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) {
      return this.fail('MALFORMED', 'Invalid token structure (expected 3 base64url segments)');
    }
    const [h, p, s] = parts;

    let header: z.infer<typeof HeaderSchema>;
    try {
      header = HeaderSchema.parse(JSON.parse(Buffer.from(h, 'base64url').toString('utf8')));
    } catch {
      return this.fail('BAD_HEADER', 'Invalid token header (only EdDSA/JWT with kid is accepted)');
    }

    const key = this.registry.getVerificationKeys(nowMs).find((k) => k.kid === header.kid);
    if (!key || (key.notAfterMs !== undefined && nowMs > key.notAfterMs)) {
      return this.fail('UNKNOWN_KID', `Unknown or retired signing key "${header.kid}"`);
    }

    let sigOk = false;
    try {
      sigOk = crypto.verify(null, Buffer.from(`${h}.${p}`), key.publicKey, Buffer.from(s, 'base64url'));
    } catch {
      sigOk = false;
    }
    if (!sigOk) return this.fail('BAD_SIGNATURE', 'Token signature verification failed');

    let claims: ScopedTokenClaims;
    try {
      claims = ClaimsSchema.parse(JSON.parse(Buffer.from(p, 'base64url').toString('utf8'))) as ScopedTokenClaims;
    } catch {
      return this.fail('BAD_CLAIMS', 'Token claims are malformed');
    }
    seenOut.claims = claims;

    if (!safeEqual(claims.aud, TOKEN_AUDIENCE)) return this.fail('BAD_AUDIENCE', `Invalid audience "${claims.aud.slice(0, 60)}"`);
    const nowS = Math.floor(nowMs / 1000);
    if (nowS < claims.nbf) return this.fail('NOT_YET_VALID', 'Token is not yet valid (nbf)');
    if (nowS > claims.exp) return this.fail('EXPIRED', `Token expired at ${new Date(claims.exp * 1000).toISOString()}`);
    if (claims.exp - claims.iat > MAX_TOKEN_TTL_SECONDS || claims.exp <= claims.iat) {
      return this.fail('BAD_LIFETIME', `Token lifetime exceeds ${MAX_TOKEN_TTL_SECONDS}s`);
    }
    if (this.revocations.isRevoked(claims.jti)) return this.fail('REVOKED', `Token ${claims.jti.slice(0, 12)}... has been revoked`);

    if (!safeEqual(claims.tool, req.tool)) {
      return this.fail('WRONG_TOOL', `Tool scope mismatch: token is for "${claims.tool}", requested "${String(req.tool).slice(0, 60)}"`);
    }
    if (!safeEqual(claims.sessionId, req.sessionId)) {
      return this.fail('WRONG_SESSION', 'Session mismatch: token was issued for a different session');
    }
    const v = validateToolArgs(req.tool, req.args);
    if (!v.ok) return this.fail('INVALID_ARGS', v.error);
    if (!safeEqual(claims.argsHash, hashArgs(v.args))) {
      return this.fail('ARGS_MISMATCH', 'Argument hash mismatch: token was not issued for these exact arguments');
    }

    if (this.seen.has(claims.jti)) {
      return this.fail('REPLAY', `Replay attack detected: token jti "${claims.jti.slice(0, 12)}..." has already been redeemed`);
    }
    this.seen.set(claims.jti, claims.exp * 1000);
    return { valid: true, claims };
  }

  public reset(): void {
    this.seen.clear();
  }
}

export const credentialBroker = new CredentialBroker();
export const tokenVerifier = new TokenVerifier(credentialBroker.createPublicView(), credentialBroker.createPublicView());
// The tool server tells the broker which tokens were redeemed so only unused ones can expire/be revoked.
tokenVerifier.observer = { onRedeemed: (c) => credentialBroker.markRedeemed(c.jti) };

/** Fans one event out to several observers (ledger + broker bookkeeping). */
export function combineObservers(...obs: Array<CredentialObserver | undefined>): CredentialObserver {
  const list = obs.filter((o): o is CredentialObserver => Boolean(o));
  return {
    onIssued: (c, t) => list.forEach((o) => o.onIssued?.(c, t)),
    onRedeemed: (c) => list.forEach((o) => o.onRedeemed?.(c)),
    onRejected: (i) => list.forEach((o) => o.onRejected?.(i)),
    onRevoked: (i) => list.forEach((o) => o.onRevoked?.(i)),
    onExpired: (i) => list.forEach((o) => o.onExpired?.(i)),
    onKeyRotated: (i) => list.forEach((o) => o.onKeyRotated?.(i)),
  };
}
