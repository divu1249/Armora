import { analyzeRecipients } from './emailRecipients.ts';
import { normalizeContent } from './normalization.ts';
import { isUntrusted } from './sessionState.ts';
import type { Segment, ToolCall, TrustLevel } from './types.ts';

/**
 * Argument provenance (honest and limited).
 * For each tool call we ask: do the sensitive arguments (recipient, payee, amount, identifiers)
 * appear in untrusted segments? We look for exact text, normalized text (NFKC, lowercase,
 * zero-width/whitespace/markdown stripped, "[at]" / "[dot]" style obfuscation undone) and
 * base64-decoded substrings.
 *
 * THIS IS A SIGNAL, NOT A GUARANTEE. A model that paraphrases, translates, spells the value out,
 * splits it across segments or computes it defeats text matching. A miss never proves that a value
 * is trustworthy.
 */

export type SensitiveKind = 'recipient' | 'payee' | 'amount' | 'identifier';
export type MatchMethod = 'exact' | 'normalized' | 'base64';

export interface SensitiveArg {
  arg: string;
  kind: SensitiveKind;
  value: string;
}

export interface ProvenanceMatch {
  arg: string;
  kind: SensitiveKind;
  value: string;
  segmentId: string;
  trust: TrustLevel;
  untrusted: boolean;
  /** offsets into the ORIGINAL segment content (for base64: the span of the base64 text) */
  start: number;
  end: number;
  method: MatchMethod;
}

export interface ArgProvenance {
  sensitiveArgs: SensitiveArg[];
  matches: ProvenanceMatch[];
  /** at least one sensitive argument matched text inside an untrusted segment */
  argDerivedFromUntrusted: boolean;
  /** ...and that argument is a recipient or payee (what rule R7 looks at) */
  recipientOrPayeeDerivedFromUntrusted: boolean;
  note: string;
}

export const PROVENANCE_NOTE =
  'Provenance matching is a signal, not a guarantee: paraphrased, spelled-out, translated or split values are not detected.';

export function extractSensitiveArgs(call: ToolCall): SensitiveArg[] {
  const out: SensitiveArg[] = [];
  const args = (call.args ?? {}) as Record<string, unknown>;
  if (call.tool === 'send_email') {
    for (const key of ['to', 'cc', 'bcc']) {
      if (args[key] === undefined) continue;
      for (const a of analyzeRecipients({ to: args[key] }).addresses) out.push({ arg: key, kind: 'recipient', value: a });
    }
  }
  if (call.tool === 'issue_refund') {
    if (typeof args.upiId === 'string') out.push({ arg: 'upiId', kind: 'payee', value: args.upiId.trim().toLowerCase() });
    if (typeof args.amount === 'number' && Number.isFinite(args.amount)) out.push({ arg: 'amount', kind: 'amount', value: String(args.amount) });
  }
  for (const key of ['candidateId', 'orderId']) {
    if (typeof args[key] === 'string') out.push({ arg: key, kind: 'identifier', value: (args[key] as string).toLowerCase() });
  }
  return out;
}

const INVISIBLE = /[\u200b-\u200f\u2060\ufeff\u00ad]/;
const DROP = /[\s"'`<>()[\]{}*_\\|]/;
const AT_RE = /[[({]\s*at\s*[\])}]/iy;
const DOT_RE = /[[({]\s*dot\s*[\])}]/iy;

/** Normalized text plus, for every normalized char, the index of the original char it came from. */
export function normalizeWithMap(text: string): { norm: string; map: number[] } {
  let norm = '';
  const map: number[] = [];
  let i = 0;
  while (i < text.length) {
    AT_RE.lastIndex = i;
    const at = AT_RE.exec(text);
    if (at && at.index === i) {
      norm += '@';
      map.push(i);
      i += at[0].length;
      continue;
    }
    DOT_RE.lastIndex = i;
    const dot = DOT_RE.exec(text);
    if (dot && dot.index === i) {
      norm += '.';
      map.push(i);
      i += dot[0].length;
      continue;
    }
    const cp = text.codePointAt(i)!;
    const ch = String.fromCodePoint(cp);
    const len = ch.length;
    if (!INVISIBLE.test(ch) && !DROP.test(ch)) {
      const n = ch.normalize('NFKC').toLowerCase();
      for (const c of n) {
        if (!DROP.test(c) && !INVISIBLE.test(c)) {
          norm += c;
          map.push(i);
        }
      }
    }
    i += len;
  }
  return { norm, map };
}

function findAll(haystack: string, needle: string): number[] {
  const out: number[] = [];
  if (!needle) return out;
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx < 0) break;
    out.push(idx);
    from = idx + needle.length;
  }
  return out;
}

function matchAmount(content: string, amount: number): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  for (const m of content.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const num = Number(m[0].replace(/,/g, ''));
    if (num === amount) out.push({ start: m.index!, end: m.index! + m[0].length });
  }
  return out;
}

export function findArgProvenance(call: ToolCall, segments: Segment[]): ArgProvenance {
  const sensitiveArgs = extractSensitiveArgs(call);
  const matches: ProvenanceMatch[] = [];

  for (const seg of segments) {
    const content = seg.content ?? '';
    const untrusted = isUntrusted(seg);
    const base = { segmentId: seg.id, trust: seg.trust, untrusted };
    let normCache: { norm: string; map: number[] } | null = null;
    const normalized = () => (normCache ??= normalizeWithMap(content));
    let b64Cache: ReturnType<typeof normalizeContent>['base64DecodedSubstrings'] | null = null;
    const b64 = () => (b64Cache ??= normalizeContent(content).base64DecodedSubstrings);

    for (const sa of sensitiveArgs) {
      const seen = new Set<string>();
      const push = (start: number, end: number, method: MatchMethod) => {
        const key = `${start}:${end}`;
        if (seen.has(key)) return;
        seen.add(key);
        matches.push({ arg: sa.arg, kind: sa.kind, value: sa.value, ...base, start, end, method });
      };

      if (sa.kind === 'amount') {
        for (const m of matchAmount(content, Number(sa.value))) push(m.start, m.end, 'exact');
        continue;
      }
      if (sa.value.length < 4) continue;

      // 1. exact
      for (const idx of findAll(content, sa.value)) push(idx, idx + sa.value.length, 'exact');

      // 2. normalized / fuzzy (case, spacing, zero-width, markdown, [at]/[dot])
      const { norm, map } = normalized();
      const needle = sa.value.replace(new RegExp(DROP.source, 'g'), '');
      for (const idx of findAll(norm, needle)) {
        const start = map[idx];
        const end = map[idx + needle.length - 1] + 1;
        push(start, end, 'normalized');
      }

      // 3. base64-decoded substrings
      for (const d of b64()) {
        const decoded = normalizeWithMap(d.decoded).norm;
        if (decoded.includes(needle)) push(d.start, d.end, 'base64');
      }
    }
  }

  const untrustedMatches = matches.filter((m) => m.untrusted);
  return {
    sensitiveArgs,
    matches,
    argDerivedFromUntrusted: untrustedMatches.length > 0,
    recipientOrPayeeDerivedFromUntrusted: untrustedMatches.some((m) => m.kind === 'recipient' || m.kind === 'payee'),
    note: PROVENANCE_NOTE,
  };
}
