import crypto from 'crypto';
import { AuditEntry } from './types.ts';

const GENESIS_HASH = '0'.repeat(64);

/**
 * Deterministic canonical JSON serializer (sorted keys) for cryptographic hashing.
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((obj as Record<string, unknown>)[k])}`);
  return '{' + entries.join(',') + '}';
}

export function computeAuditHash(prevHash: string, data: unknown, seq: number, ts: string, type: string, sessionId: string): string {
  const payloadToHash = canonicalJson({
    seq,
    ts,
    type,
    sessionId,
    data,
    prevHash,
  });
  return crypto.createHash('sha256').update(payloadToHash).digest('hex');
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
  tailTruncationNote: string;
}

export class AuditHashChain {
  private chain: AuditEntry[] = [];

  constructor() {
    this.seedGenesis();
  }

  public seedGenesis(): void {
    this.chain = [];
    this.appendEntry({
      type: 'POLICY_DECISION',
      sessionId: 'session_genesis_000',
      data: {
        note: 'LLM Firewall Audit Hash Chain Initialized',
        version: '1.0.0',
        action: 'INITIALIZE',
      },
    });
  }

  public appendEntry(params: {
    type: AuditEntry['type'];
    sessionId: string;
    data: AuditEntry['data'];
  }): AuditEntry {
    const seq = this.chain.length;
    const ts = new Date().toISOString();
    const prevHash = seq === 0 ? GENESIS_HASH : this.chain[seq - 1].hash;

    const hash = computeAuditHash(prevHash, params.data, seq, ts, params.type, params.sessionId);

    const entry: AuditEntry = {
      seq,
      ts,
      type: params.type,
      sessionId: params.sessionId,
      data: params.data,
      prevHash,
      hash,
    };

    this.chain.push(entry);
    return entry;
  }

  public getEntries(): AuditEntry[] {
    return [...this.chain];
  }

  /**
   * Walks the entire hash chain from block 0 to the tip.
   * Verifies that each entry's prevHash matches the previous entry's hash,
   * and that hash === computeAuditHash(...).
   */
  public verifyChain(): VerificationReport {
    const tailTruncationNote =
      'Notice: Hash chain verification guarantees internal sequential integrity. Tail truncation (dropping trailing blocks) is undetectable without an external anchor / witness ledger (Roadmap).';

    if (this.chain.length === 0) {
      return { valid: true, totalEntries: 0, verifiedUpToSeq: 0, tailTruncationNote };
    }

    let expectedPrevHash = GENESIS_HASH;

    for (let i = 0; i < this.chain.length; i++) {
      const entry = this.chain[i];

      // 1. Check prevHash link
      if (entry.prevHash !== expectedPrevHash) {
        return {
          valid: false,
          totalEntries: this.chain.length,
          verifiedUpToSeq: i - 1,
          tamperedEntry: {
            seq: entry.seq,
            expectedHash: expectedPrevHash,
            actualHash: entry.prevHash,
            prevHash: entry.prevHash,
          },
          tailTruncationNote,
        };
      }

      // 2. Recompute current hash
      const recomputed = computeAuditHash(entry.prevHash, entry.data, entry.seq, entry.ts, entry.type, entry.sessionId);
      if (recomputed !== entry.hash) {
        return {
          valid: false,
          totalEntries: this.chain.length,
          verifiedUpToSeq: i - 1,
          tamperedEntry: {
            seq: entry.seq,
            expectedHash: recomputed,
            actualHash: entry.hash,
            prevHash: entry.prevHash,
          },
          tailTruncationNote,
        };
      }

      expectedPrevHash = entry.hash;
    }

    return {
      valid: true,
      totalEntries: this.chain.length,
      verifiedUpToSeq: this.chain.length - 1,
      tailTruncationNote,
    };
  }

  /**
   * Simulates malicious tampering with a historical block to demonstrate cryptographic breakage.
   */
  public tamperEntry(targetSeq: number, maliciousModification: Record<string, unknown>): { success: boolean; tamperedSeq: number } {
    if (this.chain.length <= 1) {
      // Create a dummy entry first if only genesis exists
      this.appendEntry({
        type: 'POLICY_DECISION',
        sessionId: 'session_demo_tamper',
        data: { ruleId: 'R1', action: 'deny', riskLevel: 'HIGH' },
      });
    }

    const idx = Math.min(Math.max(1, targetSeq), this.chain.length - 1);
    this.chain[idx].data = {
      ...this.chain[idx].data,
      ...maliciousModification,
      _tampered: true,
    };

    return { success: true, tamperedSeq: idx };
  }

  public reset(): void {
    this.seedGenesis();
  }
}

export const auditLog = new AuditHashChain();
