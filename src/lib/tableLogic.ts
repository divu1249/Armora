export type SortDir = 'asc' | 'desc';

export interface SortState {
  key: string;
  dir: SortDir;
}

/** Stable sort by an accessor; numbers sort numerically, everything else by locale-aware string compare. */
export function sortRows<T>(rows: readonly T[], accessor: ((row: T) => unknown) | undefined, dir: SortDir): T[] {
  if (!accessor) return [...rows];
  const factor = dir === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: accessor(row) }))
    .sort((a, b) => {
      const av = a.value;
      const bv = b.value;
      if (av === bv) return a.index - b.index;
      if (av === undefined || av === null) return 1; // empty values always last
      if (bv === undefined || bv === null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor || a.index - b.index;
      if (typeof av === 'boolean' && typeof bv === 'boolean') return (Number(av) - Number(bv)) * factor || a.index - b.index;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * factor || a.index - b.index;
    })
    .map((x) => x.row);
}

export interface Page<T> {
  rows: T[];
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
}

export function paginate<T>(rows: readonly T[], page: number, pageSize: number): Page<T> {
  const size = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(Math.max(1, Math.floor(page)), pageCount);
  const start = (p - 1) * size;
  return { rows: rows.slice(start, start + size), page: p, pageCount, total: rows.length, from: rows.length ? start + 1 : 0, to: Math.min(rows.length, start + size) };
}

/** Next sort state when a header is activated: asc -> desc -> unsorted. */
export function nextSort(current: SortState | null, key: string): SortState | null {
  if (!current || current.key !== key) return { key, dir: 'asc' };
  if (current.dir === 'asc') return { key, dir: 'desc' };
  return null;
}
