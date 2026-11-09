import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The audit-log singleton and the random per-boot secrets are created at import time:
// point AUDIT_DIR at a temp dir BEFORE the server modules load.
process.env.AUDIT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'armora-vitest-audit-'));
process.env.AUDIT_SALT_SECRET ??= 'vitest-only-salt-not-a-real-secret';

const { ALL_REGRESSION_CASES } = await import('../server/regression/index.ts');

const itemNames: Record<number, string> = {
  0: 'Build and hygiene',
  1: 'Policy engine',
  2: 'Email recipient check',
  3: 'Session state',
  4: 'Credential broker',
  5: 'Audit log',
  6: 'Red-team honesty',
  7: 'API hardening',
  8: 'Gemini',
  9: 'README',
  10: 'Gateway endpoints',
  11: 'Prevention',
  12: 'Blast radius, ledger, evidence, logs',
  13: 'No standing credentials',
};

for (let item = 0; item <= 13; item++) {
  describe(`Item ${item}: ${itemNames[item]}`, () => {
    const cases = ALL_REGRESSION_CASES.filter((c) => c.item === item);
    it('has regression cases', () => {
      expect(cases.length).toBeGreaterThan(0);
    });
    for (const c of cases) {
      it(c.name, async () => {
        const r = await c.run();
        // `expected`/`actual` are in the message so a failure explains itself.
        expect(r.passed, JSON.stringify({ expected: r.expected, actual: r.actual, details: r.details })).toBe(true);
      });
    }
  });
}
