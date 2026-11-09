import React from 'react';
import { cx } from './cx.ts';
import type { Tone } from './Badge.tsx';

export interface TimelineItem {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  time?: string;
  tone?: Tone;
  meta?: React.ReactNode;
}

const dot: Record<Tone, string> = { neutral: 'bg-faint', ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-danger', info: 'bg-info', accent: 'bg-accent' };

export const Timeline: React.FC<{ items: TimelineItem[]; activeId?: string; label?: string }> = ({ items, activeId, label = 'Timeline' }) => (
  <ol aria-label={label} className="relative space-y-4 border-l border-line pl-6">
    {items.map((it) => (
      <li key={it.id} aria-current={it.id === activeId ? 'step' : undefined} className={cx('relative', activeId && it.id !== activeId && 'opacity-60')}>
        <span aria-hidden="true" className={cx('absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-surface', dot[it.tone ?? 'neutral'])} />
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-fg">{it.title}</p>
          {it.time && <span className="tabular font-mono text-2xs text-muted">{it.time}</span>}
        </div>
        {it.description && <p className="mt-0.5 text-xs text-muted">{it.description}</p>}
        {it.meta && <div className="mt-1">{it.meta}</div>}
      </li>
    ))}
  </ol>
);
