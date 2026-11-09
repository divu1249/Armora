import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

process.env.AUDIT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'armora-vitest-audit2-'));
process.env.AUDIT_SALT_SECRET ??= 'vitest-only-salt-not-a-real-secret';

const { runAllSelfTests } = await import('../server/selfTest.ts');

describe('/selftest report', () => {
  it('passes completely and includes every numbered regression item', async () => {
    const report = await runAllSelfTests();
    const failed = Object.values(report.suites).flatMap((s) => s.results.filter((r) => !r.passed).map((r) => `${r.suite}: ${r.name}`));
    expect(failed).toEqual([]);
    expect(report.allPassed).toBe(true);
    const items = new Set(Object.values(report.suites).flatMap((s) => s.results.map((r) => r.item)).filter((i) => i !== undefined));
    for (let i = 0; i <= 14; i++) expect(items.has(i)).toBe(true);
  });
});
