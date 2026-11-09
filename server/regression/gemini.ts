import { checkGeminiAvailability, getGeminiModel, getGeminiStatus, setGeminiStatusForTest } from '../gemini.ts';
import { agentRunner } from '../agentRunner.ts';
import { eq, skip, suite, yes } from './helpers.ts';
import fs from 'node:fs';
import path from 'node:path';

async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    return await fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

export const geminiCases = suite(8, 'Regression 8: Gemini availability & honest fallback', [
  ['GEMINI_MODEL is read from the environment; the default is not a made-up model name', () => {
    return withEnv({ GEMINI_MODEL: 'my-model-x' }, async () => {
      const set = getGeminiModel();
      const def = await withEnv({ GEMINI_MODEL: undefined }, async () => getGeminiModel());
      return eq({ set: 'my-model-x', defaultOk: true }, { set, defaultOk: !/3\.8/.test(def) });
    });
  }],
  ['no API key => state no_key with a clear banner (simulated agent)', () => {
    return withEnv({ GEMINI_API_KEY: undefined }, async () => {
      const s = await checkGeminiAvailability();
      return yes(s.state === 'no_key' && /SIMULATED/.test(s.banner ?? ''), s.banner ?? '');
    });
  }],
  ['model not found at boot => state unavailable, banner names the model and says SIMULATED', () => {
    return withEnv({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'does-not-exist' }, async () => {
      const s = await checkGeminiAvailability(async () => {
        throw new Error('404 model not found');
      });
      return yes(s.state === 'unavailable' && /does-not-exist/.test(s.banner ?? '') && /SIMULATED/.test(s.banner ?? ''), s.banner ?? '');
    });
  }],
  ['successful tiny test call => available, no banner', () => {
    return withEnv({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'ok-model' }, async () => {
      const s = await checkGeminiAvailability(async () => undefined);
      return eq({ state: 'available', banner: null }, { state: s.state, banner: s.banner });
    });
  }],
  ['Gemini requested while unavailable => run is labelled as simulated, llmMode reflects the REAL source', () => {
    setGeminiStatusForTest({ state: 'unavailable', detail: 'regression', banner: 'Gemini unavailable (regression)' });
    return agentRunner.runScenario({ scenarioId: 's2_support_refund_hijack', firewallMode: 'enforce', llmMode: 'gemini' }).then((inc) => {
      const labelled = inc.notices.some((n) => /FALLBACK/.test(n) && /SIMULATED/.test(n) && /NOT from Gemini/.test(n));
      return eq({ mode: 'mock', requested: 'gemini', labelled: true, reason: true }, { mode: inc.llmMode, requested: inc.requestedLlmMode, labelled, reason: Boolean(inc.llmFallbackReason) });
    });
  }, { live: true }],
  ['plain mock run is labelled as a simulated fooled agent, not a model', () => {
    return agentRunner.runScenario({ scenarioId: 's4_benign_controls', firewallMode: 'enforce', llmMode: 'mock' }).then((inc) =>
      yes(inc.llmMode === 'mock' && inc.notices.some((n) => /SIMULATED fooled agent/.test(n) && /Not a real model/.test(n)))
    );
  }, { live: true }],
  ['source contract: the old unverified default model name is gone', () => {
    const f = path.resolve(process.cwd(), 'server/agentRunner.ts');
    if (!fs.existsSync(f)) return skip('source not available');
    const all = ['server/agentRunner.ts', 'server/gemini.ts', 'README.md', '.env.example'].map((x) => path.resolve(process.cwd(), x)).filter(fs.existsSync).map((x) => fs.readFileSync(x, 'utf8')).join('\n');
    return yes(!/gemini-3\.8/.test(all) && getGeminiStatus().model !== undefined);
  }],
]);
