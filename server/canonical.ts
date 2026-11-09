import crypto from 'node:crypto';

/**
 * Deterministic canonical JSON (sorted keys, undefined dropped like JSON.stringify).
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    const s = JSON.stringify(obj);
    return s === undefined ? 'null' : s;
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const rec = obj as Record<string, unknown>;
  const keys = Object.keys(rec)
    .filter((k) => rec[k] !== undefined)
    .sort();
  return '{' + keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(rec[k])}`).join(',') + '}';
}

export function sha256Hex(input: string | Buffer): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Constant-time string comparison that is also safe for unequal lengths
 * (both sides are hashed to a fixed length before timingSafeEqual).
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
