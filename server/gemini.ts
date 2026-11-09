import { GoogleGenAI } from '@google/genai';

export type GeminiState = 'unchecked' | 'available' | 'unavailable' | 'no_key';

export interface GeminiStatus {
  state: GeminiState;
  model: string;
  checkedAt: string | null;
  detail: string;
  /** Human-readable banner for the UI; null when Gemini is available */
  banner: string | null;
}

export const GEMINI_MODEL_DEFAULT = 'gemini-2.5-flash';

let status: GeminiStatus = {
  state: 'unchecked',
  model: process.env.GEMINI_MODEL || GEMINI_MODEL_DEFAULT,
  checkedAt: null,
  detail: 'Not checked yet',
  banner: 'Gemini availability has not been verified yet. Gemini mode falls back to the SIMULATED agent until a check succeeds.',
};

export function getGeminiStatus(): GeminiStatus {
  return status;
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || GEMINI_MODEL_DEFAULT;
}

export function setGeminiStatusForTest(s: Partial<GeminiStatus>): void {
  status = { ...status, ...s };
}

export function createClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'armora' } } });
}

/**
 * Boot-time probe: a tiny generateContent call against the configured model.
 * Never throws; records the outcome and a banner message.
 */
export async function checkGeminiAvailability(
  probe?: (apiKey: string, model: string) => Promise<void>
): Promise<GeminiStatus> {
  const model = getGeminiModel();
  const apiKey = process.env.GEMINI_API_KEY;
  const checkedAt = new Date().toISOString();

  if (!apiKey) {
    status = {
      state: 'no_key',
      model,
      checkedAt,
      detail: 'GEMINI_API_KEY is not set',
      banner: 'GEMINI_API_KEY is not configured. "Gemini" runs use the SIMULATED fooled agent and are labelled as simulated.',
    };
    return status;
  }
  try {
    const run =
      probe ??
      (async (key: string, m: string) => {
        const ai = createClient(key);
        await ai.models.generateContent({ model: m, contents: 'ping', config: { maxOutputTokens: 4 } });
      });
    await Promise.race([
      run(apiKey, model),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('probe timed out after 10s')), 10_000)),
    ]);
    status = { state: 'available', model, checkedAt, detail: `Model "${model}" responded to a test call`, banner: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    status = {
      state: 'unavailable',
      model,
      checkedAt,
      detail: msg.slice(0, 300),
      banner: `Gemini model "${model}" is unavailable (${msg.slice(0, 120)}). Gemini runs fall back to the SIMULATED fooled agent and are labelled as simulated. Set GEMINI_MODEL to a model your key can access.`,
    };
  }
  return status;
}
