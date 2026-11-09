import React, { useState } from 'react';
import { ShieldCheck, Info, CheckCircle2, Clock, AlertTriangle, Layers, FileCode } from 'lucide-react';

interface FeatureItem {
  category: string;
  name: string;
  status: 'BUILT' | 'PROTOTYPE' | 'SEEDED' | 'PRECOMPUTED' | 'MOCK ENRICHMENT' | 'ROADMAP';
  realAspect: string;
  simulatedAspect: string;
  notes: string;
}

export const REAL_VS_SIMULATED_DATA: FeatureItem[] = [
  {
    category: 'Input Normalization',
    name: 'Text Normalizer & Offsets',
    status: 'BUILT',
    realAspect: 'NFKC unicode normalization, stripping of 15+ zero-width/invisible control characters, bounded base64 decoding (8KB limit, depth 1), and offset mapping array.',
    simulatedAspect: 'None. Runs directly on server in pure TypeScript.',
    notes: 'Preserves original offsets so findings align with raw payload coordinates.',
  },
  {
    category: 'Detectors',
    name: 'Aadhaar Verhoeff Algorithm',
    status: 'BUILT',
    realAspect: 'Pure implementation of the Dihedral group D5 multiplication and permutation matrices. Detects all single-digit errors and 95%+ of adjacent swaps.',
    simulatedAspect: 'All Aadhaar numbers are synthetic (e.g. 2345 6789 1238). No real citizen PII is ever used.',
    notes: 'Aadhaar leading 0 or 1 rejection strictly enforced.',
  },
  {
    category: 'Detectors',
    name: 'Payment Card Luhn Algorithm',
    status: 'BUILT',
    realAspect: 'Mod-10 checksum validation for VISA, Mastercard, RuPay cards. Constant-time execution.',
    simulatedAspect: 'Synthetic test card numbers only.',
    notes: 'Used to validate cards before applying tokenized masking.',
  },
  {
    category: 'Detectors',
    name: 'Hinglish & ReDoS-Resistant Heuristics',
    status: 'BUILT',
    realAspect: 'Weighted regex pattern matcher covering instruction override, system prompt reveal, address forwarding, and Hinglish seeds (pichli saari instructions bhool jao).',
    simulatedAspect: 'Hinglish dictionary is a tiny seed list; not a full multilingual neural parser.',
    notes: 'Scores range from 0.0 to 1.0 with human-readable rationale.',
  },
  {
    category: 'Detectors',
    name: 'Canary & Exfiltration Checks',
    status: 'BUILT',
    realAspect: 'System canary token generation and SHA-256 evidence hashing. Markdown image link regex (![alt](url)) and domain allow-list checking.',
    simulatedAspect: 'Synthetic canary strings inside simulated system prompts.',
    notes: 'Prevents out-of-band pixel leaks.',
  },
  {
    category: 'Security Boundary',
    name: 'Action Gate & YAML Policy Engine',
    status: 'BUILT',
    realAspect: 'js-yaml parser validating rules R1–R6. Trifecta Guard deterministic logic (private data + untrusted context + external communication = DENY).',
    simulatedAspect: 'None. Enforces deterministic boundary in memory.',
    notes: 'Firewall modes (OFF, SHADOW, ENFORCE) accurately tested.',
  },
  {
    category: 'Security Boundary',
    name: 'Credential Broker & Scoped Tokens',
    status: 'BUILT',
    realAspect: 'Ed25519-signed 60s tokens (kid header, key rotation) bound to tool, session and SHA-256 of the full validated arguments; revocation list and kill-switch revocation; constant-time compares; single-use JTI replay protection. The tool server holds only the public key.',
    simulatedAspect: 'Simulation of the legacy pattern: the standing-key contrast is an isolated demo module, never a real credential path.',
    notes: 'Tools reject execution unless valid unexpired single-use token is presented.',
  },
  {
    category: 'Audit & Provenance',
    name: 'Append-Only Hash Chain',
    status: 'BUILT',
    realAspect: 'Keyed hash chain (Hash_n = HMAC-SHA256(key, Hash_{n-1} + canonical entry)) persisted to JSONL and re-verified on boot; detects edits, deletions and reordering; signed anchors detect tail truncation.',
    simulatedAspect: 'Anchors are a local witness simulation; production would use an external transparency log or RFC 3161 timestamping. An attacker with both the key and the files can still forge.',
    notes: 'Local anchors detect truncation unless the attacker also deletes the anchors file; only external anchoring closes that gap (ROADMAP).',
  },
  {
    category: 'Attack Intelligence',
    name: 'SimHash Campaign Clustering',
    status: 'BUILT',
    realAspect: 'Locality-sensitive 64-bit SimHash algorithm with Hamming distance matching <= 3 bits across attack payloads.',
    simulatedAspect: 'Payloads sourced from seeded attack library across 3 simulated apps.',
    notes: 'Clusters multi-agent attacks into shared threat campaigns.',
  },
  {
    category: 'Attack Intelligence',
    name: 'IP & ASN Source Enrichment',
    status: 'MOCK ENRICHMENT',
    realAspect: 'Deterministic lookup table mapping synthetic IPs/domains to ASN, hosting provider, and SPF/DKIM flags.',
    simulatedAspect: 'Local static table. Zero external network lookups to WHOIS or commercial IP threat APIs.',
    notes: 'Prevents external network calls from the firewall prototype.',
  },
  {
    category: 'Traffic Intelligence',
    name: 'Negative-Binomial Anomaly Detection',
    status: 'PRECOMPUTED',
    realAspect: 'Offline precomputed coefficients in JSON (negative-binomial regression with log(requests) offset, hour/weekday, and app/user random effects). Code calculates expected value and 95% band.',
    simulatedAspect: '14 days of hourly traffic data (336 hours) pre-generated with injected anomalies.',
    notes: 'Empirical-Bayes shrinkage ranks risky accounts without false spikes from 1-request accounts.',
  },
  {
    category: 'Incident Response',
    name: 'Blast Radius & Regulatory Drafts',
    status: 'PROTOTYPE',
    realAspect: 'Interactive SVG blast radius graph layout. Agent kill-switch key revocation. Regulatory draft templates for CERT-In 70B and DPDP 2023 with mandatory legal disclaimers.',
    simulatedAspect: 'Legal drafts are prototypes; not submitted to actual government portals.',
    notes: 'Explicit disclaimer: "Draft for legal and security review. Not legal advice."',
  },
  {
    category: 'Tool Vetting',
    name: 'MCP Pinned Specification Vetting',
    status: 'BUILT',
    realAspect: 'Computes SHA-256 hash of tool specifications. Detects prompt injection in tool docstrings and immediately triggers QUARANTINED state upon rug-pull simulation.',
    simulatedAspect: 'Simulated Model Context Protocol (MCP) server registry.',
    notes: 'Demonstrates supply-chain defense against poisoned tool definitions.',
  },
  {
    category: 'AI Model Integration',
    name: 'Agent Execution (Mock vs Gemini)',
    status: 'PROTOTYPE',
    realAspect: 'Server-side @google/genai integration with a configurable GEMINI_MODEL, a tiny boot-time availability probe, a visible banner when unavailable, and labelled fallback to the simulated agent.',
    simulatedAspect: 'Deterministic "Simulated fooled agent" mock mode provided for reliable offline demonstrations.',
    notes: 'Defaults to the simulated agent; if Gemini is unavailable the run is labelled as simulated, never presented as Gemini output.',
  },
  {
    category: 'Roadmap Features',
    name: 'External Witness Timestamping',
    status: 'ROADMAP',
    realAspect: 'Architectural specification for anchoring hash chain heads to public blockchain or RFC 3161 timestamping authority.',
    simulatedAspect: 'Not implemented in this prototype.',
    notes: 'Closes the remaining gap of local anchoring (key + files holder can forge).',
  },
  {
    category: 'Roadmap Features',
    name: 'Shared Threat Intelligence Feed',
    status: 'ROADMAP',
    realAspect: 'STIX 2.1 JSON export capability is built and functional.',
    simulatedAspect: 'Multi-tenant peer-to-peer threat sharing requires production customers and privacy-preserving federated controls.',
    notes: 'Card is shown as disabled roadmap item in UI.',
  },
];

export const RealVsSimulatedPage: React.FC = () => {
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const categories = ['ALL', ...Array.from(new Set(REAL_VS_SIMULATED_DATA.map((d) => d.category)))];
  const statuses = ['ALL', 'BUILT', 'PROTOTYPE', 'SEEDED', 'PRECOMPUTED', 'MOCK ENRICHMENT', 'ROADMAP'];

  const filtered = REAL_VS_SIMULATED_DATA.filter((item) => {
    if (filterCategory !== 'ALL' && item.category !== filterCategory) return false;
    if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;
    return true;
  });

  const getStatusBadge = (status: FeatureItem['status']) => {
    switch (status) {
      case 'BUILT':
        return 'bg-ok-solid text-ok border-ok-solid/40';
      case 'PROTOTYPE':
        return 'bg-accent-solid text-accent border-accent-solid/40';
      case 'SEEDED':
        return 'bg-accent-solid text-accent border-accent-solid/40';
      case 'PRECOMPUTED':
        return 'bg-accent-solid text-accent border-accent-solid/40';
      case 'MOCK ENRICHMENT':
        return 'bg-warn-solid text-warn border-warn-solid/40';
      case 'ROADMAP':
        return 'bg-raised text-muted border-line-strong';
      default:
        return 'bg-raised text-muted border-line-strong';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-line rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <h2 className="text-sm font-semibold text-fg flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent" />
              What is Real vs. Simulated
              <span className="text-2xs font-mono text-accent bg-accent-solid border border-accent-solid/40 px-2 py-0.5 rounded">
                [Honest Engineering Audit]
              </span>
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Transparent breakdown of pure algorithmic code, synthetic datasets, and precomputed models in this prototype.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-subtle border border-line rounded-lg px-2.5 py-1 text-xs text-fg2 focus:outline-none focus:border-accent-solid/40"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  Category: {c}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-subtle border border-line rounded-lg px-2.5 py-1 text-xs text-fg2 focus:outline-none focus:border-accent-solid/40"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  Status: {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Top Warning Banner */}
        <div className="p-3 bg-warn-solid/10 border border-warn-solid/40 text-warn rounded-lg text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-warn mt-0.5 shrink-0" />
          <div className="leading-relaxed">
            <strong className="text-fg">Engineering Honesty Guarantee: </strong>
            Every detector, credential broker, and hash chain is implemented with mathematically verifiable TypeScript code. All PII, candidate records, orders, and threat IPs are 100% synthetic. No real citizen data is ever processed, and no claims of 100% protection or personal attacker identification are made.
          </div>
        </div>
      </div>

      {/* Table of Features */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-subtle border-b border-line text-2xs text-muted font-mono uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Feature / Module</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">What is Real (Code / Math)</th>
                <th className="py-3 px-4">What is Simulated / Seeded</th>
                <th className="py-3 px-4">Architecture Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((item, idx) => (
                <tr key={idx} className="hover:bg-subtle transition-colors duration-150">
                  <td className="py-3 px-4 align-top">
                    <div className="font-semibold text-fg">{item.name}</div>
                    <div className="text-2xs font-mono text-muted">{item.category}</div>
                  </td>
                  <td className="py-3 px-4 align-top whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-2xs font-mono border font-bold ${getStatusBadge(item.status)}`}>
                      [{item.status}]
                    </span>
                  </td>
                  <td className="py-3 px-4 align-top text-fg2 leading-relaxed max-w-xs">
                    {item.realAspect}
                  </td>
                  <td className="py-3 px-4 align-top text-muted leading-relaxed max-w-xs">
                    {item.simulatedAspect}
                  </td>
                  <td className="py-3 px-4 align-top text-2xs font-mono text-accent leading-relaxed max-w-xs">
                    {item.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
