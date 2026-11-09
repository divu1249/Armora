import React from 'react';
import { cx } from './cx.ts';

export const KeyValue: React.FC<{ items: Array<{ label: React.ReactNode; value: React.ReactNode; mono?: boolean }>; className?: string }> = ({ items, className }) => (
  <dl className={cx('divide-y divide-line text-sm', className)}>
    {items.map((it, i) => (
      <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-2">
        <dt className="text-muted">{it.label}</dt>
        <dd className={cx('min-w-0 break-words text-fg', it.mono && 'font-mono text-xs')}>{it.value}</dd>
      </div>
    ))}
  </dl>
);
