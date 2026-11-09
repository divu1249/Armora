/** Pure helpers for KPI sparklines and deltas. */

export function sparklinePath(values: readonly number[], width: number, height: number, pad = 2): string {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = height - pad - ((v - min) / span) * (height - pad * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

/** Counts timestamps per bucket, oldest first; the last bucket ends at `now`. */
export function bucketize(timestamps: readonly number[], bucketMs: number, buckets: number, now: number): number[] {
  const out = new Array<number>(buckets).fill(0);
  const start = now - bucketMs * buckets;
  for (const t of timestamps) {
    if (t < start || t > now) continue;
    const idx = Math.min(buckets - 1, Math.floor((t - start) / bucketMs));
    out[idx]++;
  }
  return out;
}

export interface Delta {
  value: number;
  /** null when there is no previous value to compare with (never invent a percentage) */
  percent: number | null;
  direction: 'up' | 'down' | 'flat';
}

export function delta(current: number, previous: number): Delta {
  const value = current - previous;
  const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  return { value, percent: previous === 0 ? null : Math.round((value / previous) * 1000) / 10, direction };
}
