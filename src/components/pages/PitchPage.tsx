import React from 'react';
import {
  Shield,
  Layers,
  KeyRound,
  FileCheck2,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Code2,
  Lock,
  ArrowRight,
  Database,
  Cpu,
  FileSearch,
  Hash,
} from 'lucide-react';
import { Tooltip } from '../Tooltip.tsx';

export const PitchPage: React.FC = () => {
  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* 1. HERO THESIS BANNER */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0c1938] via-[#091124] to-[#070b14] border border-cyan-500/30 rounded-2xl p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/90 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            LLM FIREWALL · HACKATHON PITCH &amp; ARCHITECTURE
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
            The Deterministic Security Boundary for Autonomous AI Agents
          </h1>

          <div className="p-4 bg-[#070b14]/90 border border-cyan-500/50 rounded-xl shadow-inner max-w-4xl">
            <p className="text-xs font-mono text-cyan-400 uppercase tracking-widest font-bold mb-1">
              Core Security Thesis
            </p>
            <p className="text-base sm:text-lg font-serif italic text-cyan-100 leading-snug">
              &ldquo;Reading untrusted content should never authorize a sensitive action. Detectors only produce risk signals; the <span className="underline decoration-cyan-400 font-bold not-italic">ACTION GATE</span> is the security boundary.&rdquo;
            </p>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
            Standard AI guardrails try to filter prompt text. But adversaries bypass probabilistic filters in 3–5 mutations. LLM Firewall shifts the security perimeter from prompt filtering to the <strong>Credential Broker &amp; Action Gate</strong>, ensuring autonomous agents can never execute sensitive tools without deterministic cryptographic authorization.
          </p>
        </div>
      </div>

      {/* 2. THE FIVE-STEP PIPELINE DIAGRAM */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              The Five-Step Pipeline Architecture
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              How untrusted user input is isolated, analyzed, and gated before tool execution
            </p>
          </div>
          <span className="text-2xs font-mono text-cyan-300 bg-cyan-950 border border-cyan-800 px-2.5 py-1 rounded">
            [DETERMINISTIC PIPELINE]
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
          {/* Step 1 */}
          <div className="bg-[#0b1329] border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 space-y-2 transition-all duration-150 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-700 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <span className="text-2xs font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">INGEST</span>
              </div>
              <h3 className="text-xs font-bold text-white">Tag &amp; Normalize</h3>
              <p className="text-2xs text-slate-400 leading-relaxed">
                NFKC unicode normalization, zero-width character stripping, bounded base64 decoding (8KB max). Segments tagged with trust labels (SYSTEM, USER, RETRIEVED_DOC).
              </p>
            </div>
            <div className="font-mono text-[10px] text-cyan-400/90 pt-2 border-t border-slate-800/80">
              Offset-preserving
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-[#0b1329] border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 space-y-2 transition-all duration-150 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-700 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <span className="text-2xs font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">DETECT</span>
              </div>
              <h3 className="text-xs font-bold text-white">Risk Signals</h3>
              <p className="text-2xs text-slate-400 leading-relaxed">
                Verhoeff Aadhaar algorithm, Luhn card checks, PAN regex, system canary tokens, Markdown image exfiltration, and Hinglish injection seeds.
              </p>
            </div>
            <div className="font-mono text-[10px] text-amber-400/90 pt-2 border-t border-slate-800/80">
              Salted privacy hashes
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-[#0b1329] border border-cyan-600/50 rounded-xl p-4 space-y-2 transition-all duration-150 flex flex-col justify-between ring-1 ring-cyan-500/20 shadow-md">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 font-mono text-xs font-black flex items-center justify-center">
                  3
                </span>
                <span className="text-2xs font-mono text-cyan-300 bg-cyan-950 border border-cyan-800 px-1.5 py-0.5 rounded">GATE</span>
              </div>
              <h3 className="text-xs font-bold text-cyan-300">Action Gate</h3>
              <p className="text-2xs text-slate-300 leading-relaxed">
                YAML policy engine evaluates rules R1–R6. Trifecta Guard strictly blocks sessions combining private data + untrusted context + external tools.
              </p>
            </div>
            <div className="font-mono text-[10px] text-cyan-300 font-bold pt-2 border-t border-slate-800/80">
              Deterministic boundary
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-[#0b1329] border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 space-y-2 transition-all duration-150 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-700 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center">
                  4
                </span>
                <span className="text-2xs font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">BROKER</span>
              </div>
              <h3 className="text-xs font-bold text-white">Scoped Token</h3>
              <p className="text-2xs text-slate-400 leading-relaxed">
                Issues a 60s Ed25519-signed token bound to tool, session and the SHA-256 of the full validated arguments. The tool server holds only the public key. Single-use JTI prevents replay.
              </p>
            </div>
            <div className="font-mono text-[10px] text-emerald-400 pt-2 border-t border-slate-800/80">
              No standing keys on the real path
            </div>
          </div>

          {/* Step 5 */}
          <div className="bg-[#0b1329] border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 space-y-2 transition-all duration-150 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-700 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center">
                  5
                </span>
                <span className="text-2xs font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">AUDIT</span>
              </div>
              <h3 className="text-xs font-bold text-white">Keyed Hash-Chain Ledger</h3>
              <p className="text-2xs text-slate-400 leading-relaxed">
                Every decision, token issuance, and tool outcome is appended to a keyed hash chain; verification detects edits, deletions and reordering.
              </p>
            </div>
            <div className="font-mono text-[10px] text-purple-400 pt-2 border-t border-slate-800/80">
              Tamper-evident log
            </div>
          </div>
        </div>
      </div>

      {/* 3. QR-CODE CARDS FOR DEMO & REPO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* QR 1: Demo Video */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 text-center space-y-4 hover:border-cyan-500/40 transition-colors duration-150">
          <div className="w-36 h-36 mx-auto bg-white p-2 rounded-lg shadow-md flex items-center justify-center">
            {/* Clean SVG QR Code Placeholder */}
            <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900 fill-current">
              <rect x="5" y="5" width="25" height="25" rx="3" fill="#070b14" />
              <rect x="9" y="9" width="17" height="17" fill="#ffffff" />
              <rect x="13" y="13" width="9" height="9" fill="#070b14" />
              <rect x="70" y="5" width="25" height="25" rx="3" fill="#070b14" />
              <rect x="74" y="9" width="17" height="17" fill="#ffffff" />
              <rect x="78" y="13" width="9" height="9" fill="#070b14" />
              <rect x="5" y="70" width="25" height="25" rx="3" fill="#070b14" />
              <rect x="9" y="74" width="17" height="17" fill="#ffffff" />
              <rect x="13" y="78" width="9" height="9" fill="#070b14" />
              {/* Data points */}
              <rect x="35" y="10" width="5" height="5" fill="#070b14" />
              <rect x="45" y="10" width="5" height="5" fill="#070b14" />
              <rect x="55" y="10" width="5" height="5" fill="#070b14" />
              <rect x="35" y="25" width="5" height="5" fill="#070b14" />
              <rect x="45" y="25" width="5" height="5" fill="#070b14" />
              <rect x="10" y="40" width="5" height="5" fill="#070b14" />
              <rect x="25" y="40" width="5" height="5" fill="#070b14" />
              <rect x="40" y="40" width="20" height="20" fill="#0891b2" />
              <rect x="70" y="40" width="5" height="5" fill="#070b14" />
              <rect x="85" y="40" width="5" height="5" fill="#070b14" />
              <rect x="35" y="70" width="5" height="5" fill="#070b14" />
              <rect x="50" y="75" width="15" height="5" fill="#070b14" />
              <rect x="40" y="85" width="5" height="5" fill="#070b14" />
              <rect x="75" y="75" width="15" height="15" fill="#070b14" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">3-Minute Video Pitch</h3>
            <p className="text-2xs text-slate-400 mt-1">
              Live walkthrough demonstrating attack execution, bypass failure, and credential scoping.
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800">
            <span className="text-2xs font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
              SCAN TO WATCH DEMO
            </span>
          </div>
        </div>

        {/* QR 2: Source Code */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 text-center space-y-4 hover:border-cyan-500/40 transition-colors duration-150">
          <div className="w-36 h-36 mx-auto bg-white p-2 rounded-lg shadow-md flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900 fill-current">
              <rect x="5" y="5" width="25" height="25" rx="3" fill="#070b14" />
              <rect x="9" y="9" width="17" height="17" fill="#ffffff" />
              <rect x="13" y="13" width="9" height="9" fill="#070b14" />
              <rect x="70" y="5" width="25" height="25" rx="3" fill="#070b14" />
              <rect x="74" y="9" width="17" height="17" fill="#ffffff" />
              <rect x="78" y="13" width="9" height="9" fill="#070b14" />
              <rect x="5" y="70" width="25" height="25" rx="3" fill="#070b14" />
              <rect x="9" y="74" width="17" height="17" fill="#ffffff" />
              <rect x="13" y="78" width="9" height="9" fill="#070b14" />
              <rect x="35" y="15" width="10" height="5" fill="#070b14" />
              <rect x="55" y="15" width="5" height="5" fill="#070b14" />
              <rect x="35" y="25" width="5" height="10" fill="#070b14" />
              <rect x="42" y="42" width="16" height="16" fill="#2563eb" />
              <rect x="70" y="35" width="5" height="10" fill="#070b14" />
              <rect x="85" y="35" width="5" height="5" fill="#070b14" />
              <rect x="35" y="75" width="15" height="5" fill="#070b14" />
              <rect x="55" y="75" width="5" height="15" fill="#070b14" />
              <rect x="70" y="70" width="20" height="5" fill="#070b14" />
              <rect x="75" y="85" width="15" height="5" fill="#070b14" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">GitHub Repository</h3>
            <p className="text-2xs text-slate-400 mt-1">
              Full TypeScript implementation, 29/29 self-test vectors, and Docker / Cloud Run configs.
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800">
            <span className="text-2xs font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
              SCAN TO VIEW SOURCE
            </span>
          </div>
        </div>

        {/* QR 3: Whitepaper & Architecture */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 text-center space-y-4 hover:border-cyan-500/40 transition-colors duration-150">
          <div className="w-36 h-36 mx-auto bg-white p-2 rounded-lg shadow-md flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900 fill-current">
              <rect x="5" y="5" width="25" height="25" rx="3" fill="#070b14" />
              <rect x="9" y="9" width="17" height="17" fill="#ffffff" />
              <rect x="13" y="13" width="9" height="9" fill="#070b14" />
              <rect x="70" y="5" width="25" height="25" rx="3" fill="#070b14" />
              <rect x="74" y="9" width="17" height="17" fill="#ffffff" />
              <rect x="78" y="13" width="9" height="9" fill="#070b14" />
              <rect x="5" y="70" width="25" height="25" rx="3" fill="#070b14" />
              <rect x="9" y="74" width="17" height="17" fill="#ffffff" />
              <rect x="13" y="78" width="9" height="9" fill="#070b14" />
              <rect x="40" y="10" width="10" height="5" fill="#070b14" />
              <rect x="55" y="10" width="5" height="10" fill="#070b14" />
              <rect x="35" y="30" width="15" height="5" fill="#070b14" />
              <rect x="43" y="43" width="14" height="14" fill="#10b981" />
              <rect x="70" y="45" width="10" height="5" fill="#070b14" />
              <rect x="85" y="40" width="5" height="15" fill="#070b14" />
              <rect x="35" y="70" width="15" height="5" fill="#070b14" />
              <rect x="35" y="85" width="10" height="5" fill="#070b14" />
              <rect x="70" y="75" width="5" height="15" fill="#070b14" />
              <rect x="80" y="70" width="10" height="10" fill="#070b14" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Technical Whitepaper</h3>
            <p className="text-2xs text-slate-400 mt-1">
              Formal threat model, Dihedral Verhoeff proofs, and OWASP Top 10 mitigation taxonomy.
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800">
            <span className="text-2xs font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
              SCAN TO READ SPEC
            </span>
          </div>
        </div>
      </div>

      {/* 4. VALUE PROPOSITION CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 bg-[#0b1329] border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
            <Shield className="w-4 h-4" />
            The Flaw of Prompt Guardrails
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Prompt filters inspect text with heuristics or small classifier models. Adversaries mutate spelling, use zero-width Unicode characters, or encode in Base64/Hinglish to bypass detectors in 3–5 tries. If the agent holds standing keys, the breach succeeds.
          </p>
        </div>

        <div className="p-5 bg-[#0b1329] border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold">
            <KeyRound className="w-4 h-4" />
            The Credential Broker Fix
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Instead of trusting that the LLM is never fooled, we assume the LLM WILL be fooled. The real tool server refuses standing keys and requires a single-use 60s Ed25519-signed token issued only when the Action Gate allows (or a human approves) that exact call.
          </p>
        </div>

        <div className="p-5 bg-[#0b1329] border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-purple-400 text-xs font-bold">
            <Hash className="w-4 h-4" />
            Cryptographic Auditability
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Every gate decision, token grant, and tool execution is linked into a keyed (HMAC-SHA256) hash chain persisted to an append-only file. Edits, deletions and reordering are detected; an attacker holding both the key and the files can still forge, so external anchoring is the production fix.
          </p>
        </div>
      </div>
    </div>
  );
};
