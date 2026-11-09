import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { AuditEntry } from './types.ts';
import { canonicalJson } from './canonical.ts';

export { canonicalJson };

const GENESIS_HASH = '0'.repeat(64);

export const AUDIT_INTEGRITY_NOTE =
  'Hash-chained and keyed; detects edits, deletions and reordering; an attacker with both the key and the files can still forge; external anchoring is the production fix.';
export const AUDIT_ANCHOR_NOTE =
  'Local witness simulation; production would use an external transparency log or RFC 3161 timestamping.';

export interface AuditAnchor {
  seq: number;
  headHash: string;
  ts: string;
  /** HMAC-SHA256 over canonical {seq, headHash, ts} with a key derived from the audit key */
  sig: string;
}

export interface VerificationReport {
  valid: boolean;
  totalEntries: number;
  verifiedUpToSeq: number;
  tamperedEntry?: {
    seq: number;
    expectedHash: string;
    actualHash: string;
    prevHash: string;
  };
  reason?: string;
  anchor: {
    anchorsChecked: number;
    latestAnchorSeq: number | null;
    truncationDetected: boolean;
  };
  integrityNote: string;
  anchorNote: string;
  /** kept for older UI code: same text as anchorNote */
  tailTruncationNote: string;
}

export interface EntryProof {
  entry: AuditEntry;
  entryHashValid: boolean;
  linkValid: boolean;
  path: Array<{ seq: number; prevHash: string; hash: string }>;
  pathValid: boolean;
  anchor: AuditAnchor | null;
  anchorSigValid: boolean;
  anchorMatches: boolean;
  /** entry hash, link, path and anchor all verified */
  covered: boolean;
  note: string;
}

export interface AuditQuery {
  search?: string;
  sessionId?: string;
  ruleId?: string;
  tool?: string;
  decision?: string;
  type?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

/** Newest first. Filters: session, rule, tool, decision (data.action/decision), type, date range, free text. */
export function filterAuditEntries(chain: AuditEntry[], q: AuditQuery): AuditEntry[] {
  const search = q.search?.toLowerCase();
  const from = q.from ? Date.parse(q.from) : undefined;
  const to = q.to ? Date.parse(q.to) : undefined;
  const out = chain.filter((e) => {
    const d = e.data as Record<string, unknown>;
    if (q.sessionId && e.sessionId !== q.sessionId) return false;
    if (q.type && e.type !== q.type) return false;
    if (q.ruleId && d.ruleId !== q.ruleId) return false;
    if (q.tool && d.tool !== q.tool) return false;
    if (q.decision) {
      const dec = String(d.action ?? d.decision ?? '').toLowerCase();
      if (dec !== q.decision.toLowerCase()) return false;
    }
    const t = Date.parse(e.ts);
    if (from !== undefined && !Number.isNaN(from) && t < from) return false;
    if (to !== undefined && !Number.isNaN(to) && t > to) return false;
    if (search && !JSON.stringify([e.type, e.sessionId, e.data]).toLowerCase().includes(search)) return false;
    return true;
  });
  return out.reverse();
}

const csvCell = (v: unknown): string => {
  let s = v === undefined || v === null ? '' : typeof v === 'string' ? v : JSON.stringify(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula-injection guard
  return `"${s.replace(/"/g, '""')}"`;
};

export function auditToJsonl(items: AuditEntry[]): string {
  return items.map((e) => JSON.stringify(e)).join('\n') + (items.length ? '\n' : '');
}

export function auditToCsv(items: AuditEntry[]): string {
  const head = ['seq', 'ts', 'type', 'sessionId', 'ruleId', 'tool', 'decision', 'hash', 'prevHash', 'data'];
  const rows = items.map((e) => {
    const d = e.data as Record<string, unknown>;
    return [e.seq, e.ts, e.type, e.sessionId, d.ruleId, d.tool, d.action ?? d.decision, e.hash, e.prevHash, e.data].map(csvCell).join(',');
  });
  return [head.join(','), ...rows].join('\n') + '\n';
}

export interface AuditOptions {
  /** directory for entries.jsonl / anchors.jsonl; omit for a purely in-memory chain */
  dir?: string | null;
  /** HMAC key; falls back to AUDIT_HMAC_KEY, then a key file in `dir`, then random per boot */
  key?: Buffer;
  anchorEvery?: number;
  quiet?: boolean;
}

function parseEnvKey(v: string): Buffer {
  return /^[0-9a-fA-F]{64}$/.test(v) ? Buffer.from(v, 'hex') : Buffer.from(v, 'utf8');
}

export class AuditHashChain {
  private chain: AuditEntry[] = [];
  private anchors: AuditAnchor[] = [];
  private key: Buffer;
  private anchorKey: Buffer;
  private dir: string | null;
  private anchorEvery: number;
  /** set when the files loaded at boot failed verification */
  public bootReport: VerificationReport | null = null;

  constructor(opts: AuditOptions = {}) {
    this.dir = opts.dir ?? null;
    this.anchorEvery = opts.anchorEvery ?? 10;
    if (this.dir) fs.mkdirSync(this.dir, { recursive: true }); // must exist before a key file is written
    this.key = this.resolveKey(opts);
    this.anchorKey = crypto.createHmac('sha256', this.key).update('armora-audit-anchor-v1').digest();
    if (this.dir) fs.mkdirSync(this.dir, { recursive: true });
    this.loadFromDisk();
    if (this.chain.length === 0) this.seedGenesis();
  }

  private resolveKey(opts: AuditOptions): Buffer {
    if (opts.key) return opts.key;
    const env = process.env.AUDIT_HMAC_KEY;
    if (env && env.length >= 16) return parseEnvKey(env);
    if (this.dir) {
      const keyFile = path.join(this.dir, 'audit.key');
      if (fs.existsSync(keyFile)) return Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'hex');
      const k = crypto.randomBytes(32);
      fs.writeFileSync(keyFile, k.toString('hex'), { mode: 0o600 });
      if (!opts.quiet) {
        console.warn(
          `[auditLog] AUDIT_HMAC_KEY not set: generated a random key and stored it in ${keyFile} so the chain can be re-verified after restart. Key and logs share one disk, so set AUDIT_HMAC_KEY from a secret manager in production.`
        );
      }
      return k;
    }
    if (!opts.quiet) console.warn('[auditLog] AUDIT_HMAC_KEY not set and no AUDIT_DIR: using a random per-boot key (in-memory chain).');
    return crypto.randomBytes(32);
  }

  private get entriesFile(): string | null {
    return this.dir ? path.join(this.dir, 'entries.jsonl') : null;
  }
  private get anchorsFile(): string | null {
    return this.dir ? path.join(this.dir, 'anchors.jsonl') : null;
  }

  private readJsonl<T>(file: string | null): { items: T[]; badLines: number } {
    if (!file || !fs.existsSync(file)) return { items: [], badLines: 0 };
    const items: T[] = [];
    let badLines = 0;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        items.push(JSON.parse(line) as T);
      } catch {
        badLines++;
      }
    }
    return { items, badLines };
  }

  private loadFromDisk(): void {
    if (!this.dir) return;
    const e = this.readJsonl<AuditEntry>(this.entriesFile);
    const a = this.readJsonl<AuditAnchor>(this.anchorsFile);
    this.chain = e.items;
    this.anchors = a.items;
    if (this.chain.length > 0 || this.anchors.length > 0 || e.badLines > 0 || a.badLines > 0) {
      const report = this.verifyChain();
      if (e.badLines > 0 || a.badLines > 0) {
        report.valid = false;
        report.reason = `${e.badLines + a.badLines} unreadable line(s) in the audit files`;
      }
      this.bootReport = report;
      if (!report.valid) console.error(`[auditLog] Integrity check FAILED at boot: ${report.reason ?? 'chain broken'}`);
    }
  }

  public computeHash(entry: Omit<AuditEntry, 'hash'>): string {
    return crypto
      .createHmac('sha256', this.key)
      .update(entry.prevHash + canonicalJson({ seq: entry.seq, ts: entry.ts, type: entry.type, sessionId: entry.sessionId, data: entry.data, prevHash: entry.prevHash }))
      .digest('hex');
  }

  private signAnchor(a: Omit<AuditAnchor, 'sig'>): string {
    return crypto.createHmac('sha256', this.anchorKey).update(canonicalJson({ seq: a.seq, headHash: a.headHash, ts: a.ts })).digest('hex');
  }

  public seedGenesis(): void {
    this.chain = [];
    this.anchors = [];
    this.appendEntry({
      type: 'POLICY_DECISION',
      sessionId: 'session_genesis_000',
      data: {
        note: 'Armora audit log initialized',
        version: '2.0.0',
        action: 'INITIALIZE',
      },
    });
  }

  public appendEntry(params: { type: AuditEntry['type']; sessionId: string; data: AuditEntry['data'] }): AuditEntry {
    const seq = this.chain.length;
    const ts = new Date().toISOString();
    const prevHash = seq === 0 ? GENESIS_HASH : this.chain[seq - 1].hash;
    const base = { seq, ts, type: params.type, sessionId: params.sessionId, data: params.data, prevHash };
    const entry: AuditEntry = { ...base, hash: this.computeHash(base) };
    this.chain.push(entry);
    if (this.entriesFile) fs.appendFileSync(this.entriesFile, JSON.stringify(entry) + '\n');
    if ((seq + 1) % this.anchorEvery === 0) this.createAnchor();
    return entry;
  }

  /** Write a signed checkpoint of the current head to the separate anchors file. */
  public createAnchor(): AuditAnchor {
    const head = this.chain[this.chain.length - 1];
    const base = { seq: head.seq, headHash: head.hash, ts: new Date().toISOString() };
    const anchor: AuditAnchor = { ...base, sig: this.signAnchor(base) };
    this.anchors.push(anchor);
    if (this.anchorsFile) fs.appendFileSync(this.anchorsFile, JSON.stringify(anchor) + '\n');
    return anchor;
  }

  public getAnchors(): AuditAnchor[] {
    return [...this.anchors];
  }

  public getEntries(): AuditEntry[] {
    return [...this.chain];
  }

  private equalHex(a: unknown, b: unknown): boolean {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  /**
   * Walks the chain: seq must equal position (catches reorder/duplicate/delete), prevHash must link,
   * the keyed HMAC must match, and the newest valid anchor must still be present in the chain
   * (catches tail truncation).
   */
  public verifyChain(): VerificationReport {
    const mk = (over: Partial<VerificationReport>): VerificationReport => ({
      valid: true,
      totalEntries: this.chain.length,
      verifiedUpToSeq: this.chain.length - 1,
      anchor: { anchorsChecked: 0, latestAnchorSeq: null, truncationDetected: false },
      integrityNote: AUDIT_INTEGRITY_NOTE,
      anchorNote: AUDIT_ANCHOR_NOTE,
      tailTruncationNote: AUDIT_ANCHOR_NOTE,
      ...over,
    });

    let expectedPrev = GENESIS_HASH;
    for (let i = 0; i < this.chain.length; i++) {
      const entry = this.chain[i];
      const broken = (reason: string, expectedHash: string): VerificationReport =>
        mk({
          valid: false,
          verifiedUpToSeq: i - 1,
          reason,
          tamperedEntry: { seq: entry?.seq ?? i, expectedHash, actualHash: String(entry?.hash), prevHash: String(entry?.prevHash) },
        });

      if (!entry || entry.seq !== i) return broken(`Sequence mismatch at position ${i} (found seq ${entry?.seq}): reordered, duplicated or deleted entry`, String(i));
      if (!this.equalHex(entry.prevHash, expectedPrev)) return broken('prevHash does not link to the previous entry', expectedPrev);
      const { hash: _h, ...rest } = entry;
      const recomputed = this.computeHash(rest);
      if (!this.equalHex(recomputed, entry.hash)) return broken('Keyed hash mismatch: entry was modified or forged without the key', recomputed);
      expectedPrev = entry.hash;
    }

    // Anchors
    let checked = 0;
    let latest: AuditAnchor | null = null;
    let prevSeq = -1;
    for (const a of this.anchors) {
      const { sig, ...base } = a;
      if (!this.equalHex(this.signAnchor(base), sig)) {
        return mk({ valid: false, reason: `Anchor at seq ${a?.seq} has an invalid signature`, anchor: { anchorsChecked: checked, latestAnchorSeq: latest?.seq ?? null, truncationDetected: false } });
      }
      if (a.seq < prevSeq) {
        return mk({ valid: false, reason: 'Anchors are out of order', anchor: { anchorsChecked: checked, latestAnchorSeq: latest?.seq ?? null, truncationDetected: false } });
      }
      prevSeq = a.seq;
      checked++;
      latest = a;
      const at = this.chain[a.seq];
      if (!at || !this.equalHex(at.hash, a.headHash)) {
        const truncated = a.seq >= this.chain.length;
        return mk({
          valid: false,
          reason: truncated
            ? `Tail truncation detected: anchor covers seq ${a.seq} but the chain ends at seq ${this.chain.length - 1}`
            : `Chain contradicts the anchor at seq ${a.seq}`,
          anchor: { anchorsChecked: checked, latestAnchorSeq: a.seq, truncationDetected: truncated },
        });
      }
    }
    return mk({ anchor: { anchorsChecked: checked, latestAnchorSeq: latest?.seq ?? null, truncationDetected: false } });
  }

  public getEntry(seq: number): AuditEntry | undefined {
    return this.chain[seq];
  }

  /**
   * Proof for one entry: recomputes its keyed hash, checks the link to the previous entry, returns the
   * hash path up to the first anchor at or after it and whether that anchor matches the chain.
   */
  public proveEntry(seq: number): EntryProof | null {
    const entry = this.chain[seq];
    if (!entry) return null;
    const { hash: _h, ...rest } = entry;
    const entryHashValid = this.equalHex(this.computeHash(rest), entry.hash);
    const prev = seq === 0 ? GENESIS_HASH : this.chain[seq - 1]?.hash;
    const linkValid = this.equalHex(entry.prevHash, prev);
    const anchor = this.anchors.find((a) => a.seq >= seq) ?? null;
    const path: EntryProof['path'] = [];
    let pathValid = true;
    if (anchor) {
      const end = Math.min(anchor.seq, seq + 499);
      for (let i = seq; i <= end; i++) {
        const e = this.chain[i];
        if (!e) { pathValid = false; break; }
        const { hash: _x, ...r } = e;
        const before = i === 0 ? GENESIS_HASH : this.chain[i - 1]?.hash;
        if (!this.equalHex(this.computeHash(r), e.hash) || !this.equalHex(e.prevHash, before)) pathValid = false;
        path.push({ seq: e.seq, prevHash: e.prevHash, hash: e.hash });
      }
      if (end < anchor.seq) pathValid = false; // path truncated at the cap: not fully shown
    }
    let anchorSigValid = false;
    let anchorMatches = false;
    if (anchor) {
      const { sig, ...base } = anchor;
      anchorSigValid = this.equalHex(this.signAnchor(base), sig);
      anchorMatches = this.equalHex(this.chain[anchor.seq]?.hash, anchor.headHash);
    }
    return {
      entry,
      entryHashValid,
      linkValid,
      path,
      pathValid: anchor ? pathValid : false,
      anchor,
      anchorSigValid,
      anchorMatches,
      covered: Boolean(anchor && anchorSigValid && anchorMatches && pathValid),
      note: anchor
        ? AUDIT_ANCHOR_NOTE
        : 'No anchor covers this entry yet (anchors are written every N entries or on demand). The keyed hash and link are still checked. ' + AUDIT_ANCHOR_NOTE,
    };
  }

  public query(q: AuditQuery = {}): { items: AuditEntry[]; total: number; page: number; pageSize: number } {
    const items = filterAuditEntries(this.chain, q);
    const pageSize = Math.min(Math.max(q.pageSize ?? 25, 1), 500);
    const page = Math.max(q.page ?? 1, 1);
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
  }

  /** DEMO ONLY (route gated by DEMO_MODE): modifies a historical entry in memory. */
  public tamperEntry(targetSeq: number, maliciousModification: Record<string, unknown>): { success: boolean; tamperedSeq: number } {
    if (this.chain.length <= 1) {
      this.appendEntry({ type: 'POLICY_DECISION', sessionId: 'session_demo_tamper', data: { ruleId: 'R1', action: 'deny', riskLevel: 'HIGH' } });
    }
    const idx = Math.min(Math.max(1, targetSeq), this.chain.length - 1);
    this.chain[idx].data = { ...this.chain[idx].data, ...maliciousModification, _tampered: true };
    return { success: true, tamperedSeq: idx };
  }

  /** Demo reset: archives the old files (never deletes them) and starts a fresh chain. */
  public reset(): void {
    if (this.dir) {
      const stamp = Date.now();
      for (const f of [this.entriesFile, this.anchorsFile]) {
        if (f && fs.existsSync(f)) fs.renameSync(f, `${f}.archived-${stamp}`);
      }
    }
    this.seedGenesis();
  }
}

export const auditLog = new AuditHashChain({ dir: process.env.AUDIT_DIR || path.resolve(process.cwd(), '.audit') });
