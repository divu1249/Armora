import fs from 'node:fs';
import path from 'node:path';
import { skip, suite, yes, eq } from './helpers.ts';

const readme = () => {
  const f = path.resolve(process.cwd(), 'README.md');
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
};

export const readmeCases = suite(9, 'Regression 9: README matches the code', [
  ['removed claims: "without trusting local storage", "THESIS PROVEN", Gemini 3.8, HMAC tokens, master-key env vars', () => {
    const t = readme();
    if (!t) return skip('README not available');
    const banned = [/without trusting local storage/i, /THESIS PROVEN/i, /gemini-3\.8/i, /BROKER_HMAC_SECRET/, /MASTER_KEY_SECRET/, /60s HMAC/i, /HMAC-SHA256 token/i, /immutable/i];
    return eq([], banned.filter((b) => b.test(t)).map(String));
  }],
  ['contains a Threat model section and an honest Limitations section', () => {
    const t = readme();
    if (!t) return skip('README not available');
    return yes(/^#+\s*.*Threat model/im.test(t) && /^#+\s*.*Limitations/im.test(t));
  }],
  ['every environment variable the README documents is actually read by the code', () => {
    const t = readme();
    if (!t) return skip('README not available');
    const documented = [...t.matchAll(/^\|\s*`([A-Z][A-Z0-9_]+)`\s*\|/gm)].map((m) => m[1]);
    const srcDir = path.resolve(process.cwd(), 'server');
    if (!fs.existsSync(srcDir)) return skip('source not available');
    const code = [...fs.readdirSync(srcDir, { recursive: true }).map(String).filter((f) => f.endsWith('.ts') && !f.startsWith('regression')).map((f) => fs.readFileSync(path.join(srcDir, f), 'utf8')), fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8')].join('\n');
    const unused = documented.filter((v) => !code.includes(v));
    return eq([], unused, `${documented.length} variables documented`);
  }],
  ['README states the audit-log and anchor wording used by the code', () => {
    const t = readme();
    if (!t) return skip('README not available');
    return yes(/an attacker with both the key and the files can still forge/i.test(t) && /local witness simulation/i.test(t) && /Simulation of the legacy pattern/i.test(t));
  }],
]);
