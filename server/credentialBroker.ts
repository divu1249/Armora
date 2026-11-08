import crypto from 'crypto';
import { ScopedTokenClaims, TokenConstraints, ToolCall } from './types.ts';

const BROKER_HMAC_SECRET = process.env.BROKER_HMAC_SECRET || 'dev_broker_hmac_secret_key_llm_firewall_2026';
export const MASTER_KEY_SECRET = process.env.MASTER_KEY_SECRET || 'mk_master_standing_static_key_unbounded_privilege';

export interface TokenVerificationResult {
  valid: boolean;
  claims?: ScopedTokenClaims;
  error?: string;
  isMasterKey?: boolean;
}

export class CredentialBroker {
  private secret: string;
  private usedJtiStore: Set<string> = new Set();

  constructor(secret: string = BROKER_HMAC_SECRET) {
    this.secret = secret;
  }

  /**
   * Extracts only security-relevant argument constraints to bind to token claims.
   */
  public extractConstraints(tool: string, args: Record<string, unknown>): TokenConstraints {
    const constraints: TokenConstraints = { tool };

    if (args.to && typeof args.to === 'string') {
      constraints.recipient = args.to.trim().toLowerCase();
    } else if (args.recipient && typeof args.recipient === 'string') {
      constraints.recipient = args.recipient.trim().toLowerCase();
    }

    if (args.amount !== undefined && typeof args.amount === 'number') {
      constraints.amount = args.amount;
    }

    if (args.upiId && typeof args.upiId === 'string') {
      constraints.upiId = args.upiId.trim().toLowerCase();
    }

    return constraints;
  }

  /**
   * Mints a short-lived (60s) HMAC-SHA256 signed broker token.
   */
  public issueToken(params: { sessionId: string; toolCall: ToolCall }): { token: string; claims: ScopedTokenClaims } {
    const { sessionId, toolCall } = params;
    const now = Date.now();
    const jti = `jti_${now}_${crypto.randomBytes(6).toString('hex')}`;
    const constraints = this.extractConstraints(toolCall.tool, toolCall.args);

    const claims: ScopedTokenClaims = {
      jti,
      sessionId,
      tool: toolCall.tool,
      constraints,
      iat: now,
      exp: now + 60 * 1000, // 60 seconds
      aud: 'protected-tool-server',
    };

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    const token = `${header}.${payload}.${signature}`;
    return { token, claims };
  }

  /**
   * Verifies incoming credentials at the Protected Tool Server boundary.
   * Handles:
   * 1. Standing Master Key (Firewall OFF)
   * 2. Scoped Broker Token (Timing-safe signature check, expiry, replay prevention, constraint matching)
   */
  public verifyCredentials(
    credential: string,
    requestedTool: string,
    proposedArgs: Record<string, unknown>,
    isFirewallOff: boolean
  ): TokenVerificationResult {
    // Check if client presented the standing master key
    if (isFirewallOff && credential === MASTER_KEY_SECRET) {
      return {
        valid: true,
        isMasterKey: true,
      };
    }

    if (!credential || !credential.includes('.')) {
      return { valid: false, error: 'Malformed or missing broker token credential' };
    }

    const parts = credential.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid token structure (expected 3 segments)' };
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify HMAC-SHA256 signature using timingSafeEqual
    const expectedSig = crypto
      .createHmac('sha256', this.secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signatureB64, 'utf-8');
    const expectedBuf = Buffer.from(expectedSig, 'utf-8');

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return { valid: false, error: 'Token HMAC signature verification failed (timing-safe check)' };
    }

    // Decode claims
    let claims: ScopedTokenClaims;
    try {
      claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8')) as ScopedTokenClaims;
    } catch {
      return { valid: false, error: 'Failed to decode token payload JSON' };
    }

    // Check expiry
    const now = Date.now();
    if (now > claims.exp) {
      return { valid: false, error: `Token expired at ${new Date(claims.exp).toISOString()} (now: ${new Date(now).toISOString()})` };
    }

    // Check audience
    if (claims.aud !== 'protected-tool-server') {
      return { valid: false, error: `Invalid audience: "${claims.aud}"` };
    }

    // Check tool match
    if (claims.tool !== requestedTool) {
      return { valid: false, error: `Tool scope mismatch: token is for "${claims.tool}", requested "${requestedTool}"` };
    }

    // Single-use replay protection
    if (this.usedJtiStore.has(claims.jti)) {
      return { valid: false, error: `Replay attack detected: token jti "${claims.jti}" has already been redeemed` };
    }

    // Check bound argument constraints
    const actualConstraints = this.extractConstraints(requestedTool, proposedArgs);

    if (claims.constraints.recipient && claims.constraints.recipient !== actualConstraints.recipient) {
      return {
        valid: false,
        error: `Argument tampering: bound recipient "${claims.constraints.recipient}" != proposed "${actualConstraints.recipient}"`,
      };
    }

    if (claims.constraints.amount !== undefined && claims.constraints.amount !== actualConstraints.amount) {
      return {
        valid: false,
        error: `Argument tampering: bound amount "${claims.constraints.amount}" != proposed "${actualConstraints.amount}"`,
      };
    }

    if (claims.constraints.upiId && claims.constraints.upiId !== actualConstraints.upiId) {
      return {
        valid: false,
        error: `Argument tampering: bound UPI ID "${claims.constraints.upiId}" != proposed "${actualConstraints.upiId}"`,
      };
    }

    // Mark as redeemed
    this.usedJtiStore.add(claims.jti);

    return {
      valid: true,
      claims,
      isMasterKey: false,
    };
  }

  public resetUsedJtis(): void {
    this.usedJtiStore.clear();
  }
}

export const credentialBroker = new CredentialBroker();
