import fs from 'node:fs';
import path from 'node:path';
import { skip, suite, yes, eq } from './helpers.ts';

const root = () => process.cwd();
const read = (rel: string): string | null => {
  const f = path.resolve(root(), rel);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
};
const needSource = <T>(fn: (pkg: Record<string, any>) => T | ReturnType<typeof skip>) => () => {
  const p = read('package.json');
  if (!p) return skip('not a source checkout');
  return fn(JSON.parse(p)) as never;
};

export const buildCases = suite(0, 'Regression 0: Build and hygiene', [
  ['package name is "armora" and engines.node is ">=22"', needSource((p) => eq({ n: 'armora', e: '>=22' }, { n: p.name, e: p.engines?.node }))],
  ['esbuild is not pinned (it conflicts with vite 8 peer range)', needSource((p) => eq(false, 'esbuild' in { ...p.dependencies, ...p.devDependencies }))],
  ['scripts: lint = tsc --noEmit, test = vitest --run, dev present', needSource((p) => eq({ l: 'tsc --noEmit', t: 'vitest --run', d: true }, { l: p.scripts.lint, t: p.scripts.test, d: Boolean(p.scripts.dev) }))],
  ['required dependencies declared: zod, email-addresses, vitest', needSource((p) => {
    const all = { ...p.dependencies, ...p.devDependencies };
    return eq([true, true, true], ['zod', 'email-addresses', 'vitest'].map((k) => k in all));
  })],
  ['only one package manager lockfile (bun.lock removed)', () => {
    if (!read('package.json')) return skip('not a source checkout');
    const locks = ['bun.lock', 'bun.lockb', 'yarn.lock', 'pnpm-lock.yaml'].filter((f) => fs.existsSync(path.resolve(root(), f)));
    return eq([], locks);
  }],
  ['.aistudio/ is git-ignored and absent from the working tree', () => {
    const gi = read('.gitignore');
    if (gi === null) return skip('not a source checkout');
    return yes(/^\.aistudio\/$/m.test(gi) && !fs.existsSync(path.resolve(root(), '.aistudio')));
  }],
  ['CI workflow runs npm ci, tsc --noEmit and vitest', () => {
    const w = read('.github/workflows/ci.yml');
    if (w === null) return read('package.json') ? { passed: false, expected: 'workflow present', actual: 'missing' } : skip('not a source checkout');
    return yes(/npm ci/.test(w) && /tsc --noEmit/.test(w) && /vitest --run/.test(w) && /node-version:\s*22/.test(w));
  }],
  ['.env.example contains no real-looking secret and documents the new variables', () => {
    const e = read('.env.example');
    if (e === null) return skip('not a source checkout');
    return yes(['DEMO_MODE', 'ADMIN_TOKEN', 'GEMINI_MODEL', 'AUDIT_DIR', 'APP_URL'].every((k) => e.includes(k)) && !/MY_GEMINI_API_KEY/.test(e));
  }],
]);
