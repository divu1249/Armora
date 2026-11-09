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

export const TOKEN_TTL_SECONDS = 60;
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
  now?: () => number;
  /** suppress the "random key generated" warning (tests, isolated red-team stacks) */
  quiet?: boolean;
}

export class CredentialBroker {
  private current: { privateKey: crypto.KeyObject; publicKey: crypto.KeyObject; kid: string };
  private previous?: { publicKey: crypto.KeyObject; kid: string; notAfterMs: number };
  /** jti -> { sub, expMs } for tokens that are still live (used by kill switch) */
  private outstanding = new Map<string, { sub: string; expMs: number }>();
  /** revoked-jti set, entries expire with the token */
  private revoked = new Map<string, number>();
  private now: () => number;

  constructor(opts: BrokerOptions = {}) {
    this.now = opts.now ?? Date.now;
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

  /** Rotate the signing key. The previous PUBLIC key is accepted for at most one token TTL. */
  public rotateKey(seed: Buffer = crypto.randomBytes(32)): { oldKid: string; newKid: string } {
    const oldKid = this.current.kid;
    this.previous = {
      publicKey: this.current.publicKey,
      kid: oldKid,
      notAfterMs: this.now() + TOKEN_TTL_SECONDS * 1000,
    };
    this.current = keyPairFromSeed(seed);
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
    for (const [jti, v] of this.outstanding) if (v.expMs < nowMs) this.outstanding.delete(jti);
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
      exp: iat + TOKEN_TTL_SECONDS,
      aud: TOKEN_AUDIENCE,
    };
    const header = { alg: 'EdDSA', typ: 'JWT', kid: this.current.kid };
    const h = Buffer.from(JSON.stringify(header)).toString('base64url');
    const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const sig = crypto.sign(null, Buffer.from(`${h}.${p}`), this.current.privateKey).toString('base64url');
    this.outstanding.set(claims.jti, { sub: claims.sub, expMs: claims.exp * 1000 });
    return { token: `${h}.${p}.${sig}`, claims };
  }

  public revokeToken(jti: string, expMs?: number): void {
    this.revoked.set(jti, expMs ?? this.now() + TOKEN_TTL_SECONDS * 1000);
    this.outstanding.delete(jti);
  }

  /** Kill switch: revoke every outstanding token of the agent. Returns the number revoked. */
  public revokeAgent(agentId: string): number {
    this.cleanup(this.now());
    let n = 0;
    for (const [jti, v] of this.outstanding) {
      if (v.sub === agentId) {
        this.revoked.set(jti, v.expMs);
        this.outstanding.delete(jti);
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

  constructor(
    private registry: PublicKeyRegistry,
    private revocations: RevocationList,
    opts: { now?: () => number } = {}
  ) {
    this.now = opts.now ?? Date.now;
  }

  private fail(code: VerifyCode, error: string): TokenVerificationResult {
    return { valid: false, code, error };
  }

  public verify(
    token: unknown,
    req: { tool: string; sessionId: string; args: Record<string, unknown> }
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

    if (!safeEqual(claims.aud, TOKEN_AUDIENCE)) return this.fail('BAD_AUDIENCE', `Invalid audience "${claims.aud.slice(0, 60)}"`);
    const nowS = Math.floor(nowMs / 1000);
    if (nowS < claims.nbf) return this.fail('NOT_YET_VALID', 'Token is not yet valid (nbf)');
    if (nowS > claims.exp) return this.fail('EXPIRED', `Token expired at ${new Date(claims.exp * 1000).toISOString()}`);
    if (claims.exp - claims.iat > TOKEN_TTL_SECONDS || claims.exp <= claims.iat) {
      return this.fail('BAD_LIFETIME', `Token lifetime exceeds ${TOKEN_TTL_SECONDS}s`);
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
