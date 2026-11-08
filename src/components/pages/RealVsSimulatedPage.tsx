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
    realAspect: 'Issues 60s HMAC-SHA256 tokens strictly binding tool, recipient, and amount constraints. Constant-time timingSafeEqual verification. Single-use JTI replay protection.',
    simulatedAspect: 'Standing master key contrast simulated in local environment.',
    notes: 'Tools reject execution unless valid unexpired single-use token is presented.',
  },
  {
    category: 'Audit & Provenance',
    name: 'Append-Only Hash Chain',
    status: 'BUILT',
    realAspect: 'Cryptographic SHA-256 hash chaining (Hash_n = SHA256(Hash_{n-1} + canonical_JSON)). Chain walk validator and tamper detection pinpointing exact altered block sequence.',
    simulatedAspect: 'In-memory ledger seeded on boot (no external persistent disk).',
    notes: 'Tail truncation is not detectable without an external witness anchor (marked ROADMAP).',
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
    realAspect: 'Full server-side @google/genai SDK integration supporting gemini-3.8-flash with runtime error handling and latency capture.',
    simulatedAspect: 'Deterministic "Simulated fooled agent" mock mode provided for reliable offline demonstrations.',
    notes: 'Defaults to Mock for reliable demos; falls back automatically if Gemini quota is unavailable.',
  },
  {
    category: 'Roadmap Features',
    name: 'External Witness Timestamping',
    status: 'ROADMAP',
    realAspect: 'Architectural specification for anchoring hash chain heads to public blockchain or RFC 3161 timestamping authority.',
    simulatedAspect: 'Not implemented in this prototype.',
    notes: 'Required to detect tail truncation of the hash chain.',
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
        return 'bg-emerald-950 text-emerald-300 border-emerald-800';
      case 'PROTOTYPE':
        return 'bg-cyan-950 text-cyan-300 border-cyan-800';
      case 'SEEDED':
        return 'bg-blue-950 text-blue-300 border-blue-800';
      case 'PRECOMPUTED':
        return 'bg-indigo-950 text-indigo-300 border-indigo-800';
      case 'MOCK ENRICHMENT':
        return 'bg-amber-950 text-amber-300 border-amber-800';
      case 'ROADMAP':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              What is Real vs. Simulated
              <span className="text-2xs font-mono text-cyan-300 bg-cyan-950 border border-cyan-850 px-2 py-0.5 rounded">
                [Honest Engineering Audit]
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Transparent breakdown of pure algorithmic code, synthetic datasets, and precomputed models in this prototype.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-[#0b1329] border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
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
              className="bg-[#0b1329] border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
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
        <div className="p-3 bg-amber-950/40 border border-amber-800/60 text-amber-200 rounded-lg text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="leading-relaxed">
            <strong className="text-white">Engineering Honesty Guarantee: </strong>
            Every detector, credential broker, and hash chain is implemented with mathematically verifiable TypeScript code. All PII, candidate records, orders, and threat IPs are 100% synthetic. No real citizen data is ever processed, and no claims of 100% protection or personal attacker identification are made.
          </div>
        </div>
      </div>

      {/* Table of Features */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b1329] border-b border-slate-800 text-2xs text-slate-400 font-mono uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Feature / Module</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">What is Real (Code / Math)</th>
                <th className="py-3 px-4">What is Simulated / Seeded</th>
                <th className="py-3 px-4">Architecture Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filtered.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition-colors duration-150">
                  <td className="py-3 px-4 align-top">
                    <div className="font-semibold text-white">{item.name}</div>
                    <div className="text-2xs font-mono text-slate-500">{item.category}</div>
                  </td>
                  <td className="py-3 px-4 align-top whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-2xs font-mono border font-bold ${getStatusBadge(item.status)}`}>
                      [{item.status}]
                    </span>
                  </td>
                  <td className="py-3 px-4 align-top text-slate-300 leading-relaxed max-w-xs">
                    {item.realAspect}
                  </td>
                  <td className="py-3 px-4 align-top text-slate-400 leading-relaxed max-w-xs">
                    {item.simulatedAspect}
                  </td>
                  <td className="py-3 px-4 align-top text-2xs font-mono text-cyan-300/80 leading-relaxed max-w-xs">
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
