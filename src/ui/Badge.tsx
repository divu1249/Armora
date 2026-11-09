import React from 'react';
import { cx } from './cx.ts';
import { Tooltip } from './Tooltip.tsx';

export type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'accent';

const tones: Record<Tone, string> = {
  neutral: 'bg-subtle text-fg2 border-line',
  ok: 'bg-ok/10 text-ok border-ok/30',
  warn: 'bg-warn/10 text-warn border-warn/30',
  danger: 'bg-danger/10 text-danger border-danger/30',
  info: 'bg-info/10 text-info border-info/30',
  accent: 'bg-accent/10 text-accent border-accent/30',
};

export const Badge: React.FC<{ tone?: Tone; className?: string; children?: React.ReactNode; dot?: boolean }> = ({ tone = 'neutral', className, children, dot }) => (
  <span className={cx('inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-2xs font-medium leading-4 whitespace-nowrap', tones[tone], className)}>
    {dot && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
    {children}
  </span>
);

/** Honesty chips. Their meaning is explained on hover/focus and on the Real vs simulated page. */
export type ChipKind = 'BUILT' | 'PROTOTYPE' | 'SEEDED' | 'PRECOMPUTED' | 'ROADMAP' | 'SIMULATED' | 'MOCK ENRICHMENT';

export const CHIP_INFO: Record<ChipKind, { tone: Tone; meaning: string }> = {
  BUILT: { tone: 'ok', meaning: 'Real code that runs in this app and is covered by tests.' },
  PROTOTYPE: { tone: 'warn', meaning: 'Works, but is a prototype with known limits.' },
  SEEDED: { tone: 'accent', meaning: 'Sample data prepared in advance, not live traffic.' },
  PRECOMPUTED: { tone: 'info', meaning: 'Numbers calculated offline and shipped with the app.' },
  ROADMAP: { tone: 'neutral', meaning: 'Planned, not implemented.' },
  SIMULATED: { tone: 'warn', meaning: 'A stand-in that imitates a real component (for example the simulated agent).' },
  'MOCK ENRICHMENT': { tone: 'warn', meaning: 'Lookup results are generated locally, not fetched from a real intelligence service.' },
};

export const StatusChip: React.FC<{ kind: ChipKind; className?: string }> = ({ kind, className }) => (
  <Tooltip content={CHIP_INFO[kind].meaning}>
    <Badge tone={CHIP_INFO[kind].tone} className={cx('font-mono uppercase tracking-wide', className)}>
      {kind}
    </Badge>
  </Tooltip>
);

export const decisionTone = (action: string): Tone => (action === 'deny' ? 'danger' : action === 'approve' ? 'warn' : 'ok');
export const decisionLabel = (action: string): string => (action === 'deny' ? 'Blocked' : action === 'approve' ? 'Needs approval' : 'Allowed');
