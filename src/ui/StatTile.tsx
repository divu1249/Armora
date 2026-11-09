import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card } from './Card.tsx';
import { Sparkline } from './Sparkline.tsx';
import { Tooltip } from './Tooltip.tsx';
import { formatDelta, formatNumber } from '../lib/format.ts';
import type { Delta } from '../lib/sparkline.ts';
import { cx } from './cx.ts';

/**
 * KPI tile. `delta` compares the window with the previous one of the same length; when there is no
 * previous data the tile says so instead of inventing a percentage.
 * `goodDirection` says whether up is good (e.g. "blocked") or bad (e.g. "data left").
 */
export const StatTile: React.FC<{
  label: string;
  value: number | string;
  help?: string;
  delta?: Delta;
  goodDirection?: 'up' | 'down' | 'neutral';
  spark?: readonly number[];
  footnote?: string;
}> = ({ label, value, help, delta, goodDirection = 'neutral', spark, footnote }) => {
  const dir = delta?.direction ?? 'flat';
  const bad = goodDirection !== 'neutral' && dir !== 'flat' && dir !== goodDirection;
  const good = goodDirection !== 'neutral' && dir !== 'flat' && dir === goodDirection;
  const Icon = dir === 'up' ? ArrowUpRight : dir === 'down' ? ArrowDownRight : Minus;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted">
          {help ? (
            <Tooltip content={help}>
              <span tabIndex={0} className="cursor-help border-b border-dotted border-muted">
                {label}
              </span>
            </Tooltip>
          ) : (
            label
          )}
        </p>
        {spark && <Sparkline values={spark} label={`${label} trend over the window`} className={cx(bad ? 'text-danger' : good ? 'text-ok' : 'text-accent')} />}
      </div>
      <p className="tabular mt-2 text-3xl font-semibold tracking-tight text-fg">{typeof value === 'number' ? formatNumber(value) : value}</p>
      <div className="mt-1 flex min-h-5 items-center gap-1 text-xs">
        {delta && (
          <span className={cx('inline-flex items-center gap-0.5', bad ? 'text-danger' : good ? 'text-ok' : 'text-muted')}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {formatDelta(delta)}
          </span>
        )}
        {footnote && <span className="text-muted">{footnote}</span>}
      </div>
    </Card>
  );
};
