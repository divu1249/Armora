export function timeAgo(ts: number | string, now: number = Date.now()): string {
  const t = typeof ts === 'string' ? Date.parse(ts) : ts;
  if (Number.isNaN(t)) return 'unknown';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export const formatNumber = (n: number): string => new Intl.NumberFormat('en-US').format(n);

export function formatDelta(d: { value: number; percent: number | null; direction: string }): string {
  if (d.direction === 'flat') return 'no change';
  const sign = d.value > 0 ? '+' : '';
  return d.percent === null ? `${sign}${d.value} (no previous period)` : `${sign}${d.value} (${sign}${d.percent}%)`;
}

export const shortId = (id: string, n = 12): string => (id.length <= n ? id : `${id.slice(0, n)}…`);
