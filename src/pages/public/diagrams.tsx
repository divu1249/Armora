import React from 'react';

/** Simple, honest diagrams. Each is an <svg role="img"> with a text alternative. */
const box = 'fill-subtle stroke-line-strong';
const label = 'fill-fg text-[11px]';
const muted = 'fill-muted text-[10px]';

export const PreventDiagram: React.FC = () => (
  <svg role="img" aria-label="A document containing hidden instructions reaches the agent. The agent proposes a send-email call. The action gate checks the call and blocks it. No credential is created." viewBox="0 0 360 150" className="h-auto w-full">
    <rect x="8" y="14" width="86" height="44" rx="6" className={box} strokeWidth="1.5" />
    <text x="51" y="33" textAnchor="middle" className={label}>Document</text>
    <text x="51" y="48" textAnchor="middle" className={muted}>hidden orders</text>
    <rect x="8" y="88" width="86" height="44" rx="6" className={box} strokeWidth="1.5" />
    <text x="51" y="107" textAnchor="middle" className={label}>Agent</text>
    <text x="51" y="122" textAnchor="middle" className={muted}>proposes a call</text>
    <path d="M51 58v30" className="stroke-faint" strokeWidth="1.5" fill="none" />
    <path d="M94 110h58" className="stroke-faint" strokeWidth="1.5" fill="none" />
    <rect x="152" y="80" width="92" height="60" rx="6" className="fill-accent/10 stroke-accent" strokeWidth="1.5" />
    <text x="198" y="105" textAnchor="middle" className={label}>Action gate</text>
    <text x="198" y="120" textAnchor="middle" className={muted}>rules + session state</text>
    <path d="M244 110h40" className="stroke-danger" strokeWidth="1.5" strokeDasharray="4 3" fill="none" />
    <path d="M276 100l10 10m0-10l-10 10" className="stroke-danger" strokeWidth="2" fill="none" />
    <rect x="292" y="88" width="62" height="44" rx="6" className="fill-subtle stroke-line" strokeWidth="1.5" strokeDasharray="4 3" />
    <text x="323" y="107" textAnchor="middle" className={label}>Tool</text>
    <text x="323" y="122" textAnchor="middle" className={muted}>never runs</text>
  </svg>
);

export const ContainDiagram: React.FC = () => (
  <svg role="img" aria-label="A session node connects to the tool calls it made. Allowed read calls connect to the data they touched. Blocked and held calls connect to destinations marked blocked or pending. Revoked tokens are shown separately." viewBox="0 0 360 150" className="h-auto w-full">
    <rect x="8" y="55" width="70" height="40" rx="6" className={box} strokeWidth="1.5" />
    <text x="43" y="79" textAnchor="middle" className={label}>Session</text>
    <path d="M78 75h40M118 75l40-34M118 75h40M118 75l40 34" className="stroke-faint" strokeWidth="1.5" fill="none" />
    <rect x="158" y="22" width="76" height="36" rx="6" className="fill-danger/10 stroke-danger" strokeWidth="1.5" />
    <text x="196" y="44" textAnchor="middle" className={label}>read (done)</text>
    <rect x="158" y="63" width="76" height="36" rx="6" className="fill-ok/10 stroke-ok" strokeWidth="1.5" />
    <text x="196" y="85" textAnchor="middle" className={label}>send (blocked)</text>
    <rect x="158" y="104" width="76" height="36" rx="6" className="fill-warn/10 stroke-warn" strokeWidth="1.5" />
    <text x="196" y="126" textAnchor="middle" className={label}>refund (held)</text>
    <path d="M234 40h40M234 81h40M234 122h40" className="stroke-faint" strokeWidth="1.5" fill="none" />
    <rect x="274" y="22" width="80" height="36" rx="6" className={box} strokeWidth="1.5" />
    <text x="314" y="44" textAnchor="middle" className={muted}>CAND_101</text>
    <rect x="274" y="63" width="80" height="36" rx="6" className="fill-ok/10 stroke-ok" strokeWidth="1.5" />
    <text x="314" y="85" textAnchor="middle" className={muted}>evil.com</text>
    <rect x="274" y="104" width="80" height="36" rx="6" className="fill-warn/10 stroke-warn" strokeWidth="1.5" />
    <text x="314" y="126" textAnchor="middle" className={muted}>payee</text>
  </svg>
);

export const ProveDiagram: React.FC = () => (
  <svg role="img" aria-label="A row of log entries, each containing a fingerprint of the entry before it. A signed checkpoint called an anchor is stored separately and covers the latest entry." viewBox="0 0 360 150" className="h-auto w-full">
    {[0, 1, 2, 3].map((i) => (
      <g key={i}>
        <rect x={10 + i * 86} y="30" width="72" height="44" rx="6" className={box} strokeWidth="1.5" />
        <text x={46 + i * 86} y="50" textAnchor="middle" className={label}>entry {i + 1}</text>
        <text x={46 + i * 86} y="65" textAnchor="middle" className={muted}>prev + hash</text>
        {i < 3 && <path d={`M${82 + i * 86} 52h14`} className="stroke-accent" strokeWidth="1.5" fill="none" />}
      </g>
    ))}
    <path d="M298 74v36" className="stroke-faint" strokeWidth="1.5" strokeDasharray="4 3" fill="none" />
    <rect x="236" y="110" width="120" height="30" rx="6" className="fill-info/10 stroke-info" strokeWidth="1.5" />
    <text x="296" y="129" textAnchor="middle" className={label}>signed anchor (local)</text>
  </svg>
);
