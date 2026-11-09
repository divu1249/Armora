import emailAddresses from 'email-addresses';
import { domainToASCII } from 'node:url';

/**
 * Recipient extraction/normalisation for send_email.
 * - to / cc / bcc are merged into one list.
 * - A real RFC 5322 parser (email-addresses) is used; a raw-text token scan is
 *   additionally run so that display-name tricks cannot hide an address.
 * - Domains are lowercased and converted IDN -> punycode, then compared EXACTLY.
 */

export const MAX_RECIPIENTS = 100;
const RECIPIENT_KEYS = ['to', 'cc', 'bcc', 'recipient', 'recipients'] as const;

export interface RecipientAnalysis {
  ok: boolean;
  /** Normalised (lowercase, punycode) addresses found. */
  addresses: string[];
  error?: string;
}

export interface RecipientCheck extends RecipientAnalysis {
  allowed: boolean;
  disallowed: string[];
}

const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const DOMAIN_RE = new RegExp(`^${LABEL}(?:\\.${LABEL})+$`);

export function normalizeDomain(input: string): string | null {
  if (typeof input !== 'string') return null;
  let d = input.trim().toLowerCase();
  if (d.endsWith('.')) d = d.slice(0, -1);
  if (!d || d.length > 253) return null;
  const ascii = domainToASCII(d);
  if (!ascii || ascii.length > 253 || !DOMAIN_RE.test(ascii)) return null;
  return ascii;
}

function collectRaw(args: Record<string, unknown>): { raw: string[]; error?: string } {
  const raw: string[] = [];
  for (const key of RECIPIENT_KEYS) {
    const v = args[key];
    if (v === undefined) continue;
    if (typeof v === 'string') {
      raw.push(v);
    } else if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item !== 'string') return { raw, error: `"${key}" contains a non-string entry` };
        raw.push(item);
      }
    } else {
      return { raw, error: `"${key}" must be a string or an array of strings` };
    }
  }
  return { raw };
}

/** Convert the domain part of any non-ASCII "@domain" to punycode so the ASCII parser can read it. */
function punycodeDomains(s: string): string {
  return s.replace(/@([^\s<>,;"@]*[^\x00-\x7f][^\s<>,;"@]*)/g, (m, dom: string) => {
    const ascii = domainToASCII(dom.toLowerCase());
    return ascii ? `@${ascii}` : m;
  });
}

const ADDRESS_TOKEN_RE = /[^\s<>,;"'()[\]:]+@[^\s<>,;"'()[\]]+/g;

type ParsedNode = {
  type?: string;
  address?: string;
  name?: string | null;
  addresses?: ParsedNode[];
};

function flatten(nodes: ParsedNode[]): ParsedNode[] {
  const out: ParsedNode[] = [];
  for (const n of nodes) {
    if (n.type === 'group' && Array.isArray(n.addresses)) out.push(...flatten(n.addresses));
    else out.push(n);
  }
  return out;
}

function normalizeAddress(addr: string): string | null {
  const at = addr.lastIndexOf('@');
  if (at <= 0 || at === addr.length - 1) return null;
  const local = addr.slice(0, at).toLowerCase();
  const domain = normalizeDomain(addr.slice(at + 1));
  if (!domain || local.length > 64) return null;
  if (/[\s<>,;]/.test(local)) return null;
  return `${local}@${domain}`;
}

export function analyzeRecipients(args: Record<string, unknown>): RecipientAnalysis {
  const { raw, error } = collectRaw(args ?? {});
  if (error) return { ok: false, addresses: [], error };
  if (raw.length === 0) return { ok: false, addresses: [], error: 'No recipients supplied' };

  const found = new Set<string>();
  let problem: string | undefined;

  for (const entry of raw) {
    if (entry.length > 2000 || entry.trim() === '') {
      problem ??= 'Empty or oversized recipient entry';
      continue;
    }
    const text = punycodeDomains(entry);
    const parsed = emailAddresses.parseAddressList(text) as ParsedNode[] | null;
    if (!parsed || parsed.length === 0) {
      problem ??= `Malformed recipient list: "${entry.slice(0, 80)}"`;
      // still surface any address-like text so the caller sees what was attempted
    }
    const parsedSet = new Set<string>();
    for (const node of flatten(parsed ?? [])) {
      if (typeof node.address !== 'string') {
        problem ??= 'Parsed recipient has no address';
        continue;
      }
      if (typeof node.name === 'string' && node.name.includes('@')) {
        problem ??= `Display name contains an address-like string: "${node.name.slice(0, 60)}"`;
      }
      const norm = normalizeAddress(node.address);
      if (!norm) {
        problem ??= `Unparseable address: "${node.address.slice(0, 80)}"`;
        continue;
      }
      parsedSet.add(norm);
      found.add(norm);
    }
    // Belt and braces: every address-looking token in the raw text must be one the parser returned.
    for (const tok of text.match(ADDRESS_TOKEN_RE) ?? []) {
      const norm = normalizeAddress(tok.replace(/\.+$/, ''));
      if (!norm) {
        problem ??= `Unparseable address-like text: "${tok.slice(0, 80)}"`;
        continue;
      }
      if (!parsedSet.has(norm)) {
        problem ??= `Address-like text "${norm}" is not a recipient according to the parser (possible display-name trick)`;
      }
      found.add(norm);
    }
  }

  const addresses = Array.from(found);
  if (addresses.length === 0) problem ??= 'No valid recipient addresses';
  if (addresses.length > MAX_RECIPIENTS) problem ??= `Too many recipients (${addresses.length})`;
  return problem ? { ok: false, addresses, error: problem } : { ok: true, addresses };
}

/** EVERY address must have a domain exactly equal to an allowed domain. Fail closed on any doubt. */
export function checkRecipientsAllowed(args: Record<string, unknown>, allowedDomains: string[]): RecipientCheck {
  const analysis = analyzeRecipients(args);
  const allowedSet = new Set(allowedDomains.map((d) => normalizeDomain(d)).filter((d): d is string => d !== null));
  const disallowed = analysis.addresses.filter((a) => !allowedSet.has(a.slice(a.lastIndexOf('@') + 1)));
  const allowed = analysis.ok && disallowed.length === 0 && analysis.addresses.length > 0;
  return { ...analysis, allowed, disallowed };
}
