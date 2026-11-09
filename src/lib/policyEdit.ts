import { dump, load } from 'js-yaml';

export interface RuleView {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  /** fields other than the common ones, shown as key/value */
  params: Record<string, unknown>;
}

export interface ParsedYaml {
  ok: boolean;
  error?: string;
  version?: string;
  name?: string;
  rules: RuleView[];
}

export function parsePolicyForView(yamlText: string): ParsedYaml {
  try {
    const doc = load(yamlText) as { version?: unknown; name?: unknown; rules?: unknown } | null;
    if (!doc || typeof doc !== 'object') return { ok: false, error: 'The policy must be a YAML mapping.', rules: [] };
    const rules = Array.isArray(doc.rules) ? doc.rules : [];
    return {
      ok: true,
      version: doc.version === undefined ? undefined : String(doc.version),
      name: doc.name === undefined ? undefined : String(doc.name),
      rules: rules
        .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
        .map((r) => {
          const { id, name, description, enabled, ...params } = r;
          return { id: String(id), name: String(name ?? id), description: String(description ?? ''), enabled: enabled === true, params };
        }),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.split('\n')[0] : 'Invalid YAML', rules: [] };
  }
}

/** Toggle one rule's `enabled` flag and re-serialise. Returns the original text if it cannot be parsed. */
export function setRuleEnabled(yamlText: string, ruleId: string, enabled: boolean): string {
  try {
    const doc = load(yamlText) as { rules?: Array<Record<string, unknown>> } | null;
    if (!doc || !Array.isArray(doc.rules)) return yamlText;
    for (const r of doc.rules) if (r && r.id === ruleId) r.enabled = enabled;
    return dump(doc, { lineWidth: 100, noRefs: true });
  } catch {
    return yamlText;
  }
}
