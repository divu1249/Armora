import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  term: string;
  explanation: string;
  children?: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ term, explanation, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span
      className="relative inline-flex items-center group cursor-help"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
      tabIndex={0}
      role="tooltip"
      aria-label={`${term}: ${explanation}`}
    >
      {children || (
        <span className="inline-flex items-center gap-1 border-b border-dotted border-cyan-400/50 text-cyan-200">
          {term}
          <HelpCircle className="w-3 h-3 text-cyan-400/70 inline" />
        </span>
      )}

      {isOpen && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-[#0b1329] border border-cyan-500/40 rounded-lg shadow-xl text-left pointer-events-none animate-in fade-in zoom-in-95 duration-150"
          style={{ minWidth: '220px' }}
        >
          <div className="text-2xs font-bold text-cyan-300 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>{term}</span>
            <span className="text-[9px] font-mono text-slate-400 bg-slate-800/80 px-1 rounded">EXPLAINER</span>
          </div>
          <div className="text-xs text-slate-200 leading-relaxed font-normal">
            {explanation}
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-[#0b1329]" />
        </div>
      )}
    </span>
  );
};

export const GLOSSARY: Record<string, string> = {
  'Action Gate': 'The deterministic security boundary that enforces policy before sensitive tools run. Detectors only flag risk; the gate makes the allow/deny/approve decision.',
  'Trifecta Guard': 'Security rule R2: if a session combines private data (e.g. resumes) + untrusted text + external communication (e.g. email), execution is strictly denied.',
  'Canary Token': 'A secret cryptographic token hidden inside the system prompt. If detected in outbound content, prompt leakage is proven.',
  'Verhoeff Checksum': 'Dihedral group D5 algorithm validating 12-digit Indian Aadhaar numbers, catching all single-digit errors and 95%+ of adjacent swaps.',
  'Luhn Checksum': 'Mod-10 checksum algorithm used to validate credit and debit card primary account numbers before masking.',
  'Scoped HMAC Token': 'A single-use 60-second Ed25519-signed token issued by the credential broker, bound to the tool, the session and a SHA-256 hash of the exact arguments.',
  'Hash Chain': 'An append-only cryptographic ledger where each audit entry is keyed-hashed (HMAC-SHA256) together with the previous hash, so edits, deletions and reordering are detectable; an attacker holding the key and the files can still forge.',
  'Empirical-Bayes': 'Statistical shrinkage algorithm that stabilizes risk scores for low-volume accounts by pulling them toward the fleet prior mean.',
  'SimHash': 'Locality-sensitive 64-bit hashing algorithm that groups similar attack payloads into common campaigns across different agents.',
  'Prompt Injection': 'Adversarial manipulation embedded in text or retrieved documents intended to hijack an AI agent’s instructions.',
};
