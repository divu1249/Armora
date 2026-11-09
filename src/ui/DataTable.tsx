import React, { useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ChevronsUpDown, Rows3 } from 'lucide-react';
import { cx } from './cx.ts';
import { Button } from './Button.tsx';
import { Skeleton } from './Skeleton.tsx';
import { EmptyState } from './EmptyState.tsx';
import { nextSort, paginate, sortRows, SortState } from '../lib/tableLogic.ts';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** enables sorting on this column */
  sortValue?: (row: T) => unknown;
  align?: 'left' | 'right';
  className?: string;
  /** hide below the md breakpoint (tablet-first responsive) */
  hideOnNarrow?: boolean;
}

export type Density = 'comfortable' | 'compact';
const DENSITY_KEY = 'armora.density';

export function useDensity(): [Density, (d: Density) => void] {
  const [d, setD] = useState<Density>(() => {
    try {
      return localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable';
    } catch {
      return 'comfortable';
    }
  });
  const set = (v: Density) => {
    setD(v);
    try {
      localStorage.setItem(DENSITY_KEY, v);
    } catch {
      /* ignore */
    }
  };
  return [d, set];
}

export interface DataTableProps<T> {
  caption: string;
  columns: Array<Column<T>>;
  rows: readonly T[];
  getRowId: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  pageSize?: number;
  initialSort?: SortState | null;
  toolbar?: React.ReactNode;
  /** renders the row as selectable: Enter/Space/click call this */
  onRowActivate?: (row: T) => void;
  maxHeight?: string;
  className?: string;
}

/**
 * Sortable, paginated table with a sticky header, density toggle and explicit loading / error / empty states.
 * Sorting and paging are client-side over the rows given. Headers are real buttons with aria-sort.
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  getRowId,
  loading,
  error,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  pageSize = 10,
  initialSort = null,
  toolbar,
  onRowActivate,
  maxHeight = 'max-h-[34rem]',
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(initialSort);
  const [page, setPage] = useState(1);
  const [density, setDensity] = useDensity();
  const capId = useId();

  const sorted = useMemo(() => {
    const col = sort ? columns.find((c) => c.key === sort.key) : undefined;
    return sort && col ? sortRows(rows, col.sortValue, sort.dir) : [...rows];
  }, [rows, sort, columns]);
  const pg = useMemo(() => paginate(sorted, page, pageSize), [sorted, page, pageSize]);
  useEffect(() => {
    if (page !== pg.page) setPage(pg.page);
  }, [page, pg.page]);

  const cellPad = density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3';
  const hide = (c: Column<T>) => (c.hideOnNarrow ? 'hidden md:table-cell' : '');

  return (
    <div className={cx('overflow-hidden rounded-lg border border-line bg-surface', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
        <Button variant="ghost" size="sm" onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')} aria-pressed={density === 'compact'} leftIcon={<Rows3 className="h-3.5 w-3.5" aria-hidden="true" />}>
          {density === 'compact' ? 'Compact' : 'Comfortable'}
        </Button>
      </div>

      {error ? (
        <div role="alert" className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <AlertTriangle className="h-6 w-6 text-danger" aria-hidden="true" />
          <p className="text-sm font-medium text-fg">Could not load this table</p>
          <p className="max-w-md text-xs text-muted">{error}</p>
          {onRetry && (
            <Button size="sm" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      ) : (
        <div className={cx('overflow-auto', maxHeight)}>
          <table className="w-full border-collapse text-left text-sm" aria-labelledby={capId} aria-busy={loading || undefined}>
            <caption id={capId} className="sr-only">
              {caption}
            </caption>
            <thead>
              <tr>
                {columns.map((c) => {
                  const active = sort?.key === c.key;
                  const ariaSort = active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : c.sortValue ? 'none' : undefined;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={ariaSort}
                      className={cx('sticky top-0 z-10 border-b border-line bg-subtle text-2xs font-semibold uppercase tracking-wide text-muted', cellPad, c.align === 'right' && 'text-right', hide(c))}
                    >
                      {c.sortValue ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSort((s) => nextSort(s, c.key));
                            setPage(1);
                          }}
                          className="inline-flex items-center gap-1 uppercase hover:text-fg"
                        >
                          {c.header}
                          {active ? sort!.dir === 'asc' ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" /> : <ChevronsUpDown className="h-3 w-3 opacity-60" aria-hidden="true" />}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: Math.min(pageSize, 5) }, (_, i) => (
                    <tr key={`sk-${i}`} className="border-b border-line">
                      {columns.map((c) => (
                        <td key={c.key} className={cx(cellPad, hide(c))}>
                          <Skeleton className="h-4 w-full max-w-[12rem]" />
                        </td>
                      ))}
                    </tr>
                  ))
                : pg.rows.map((row) => {
                    const id = getRowId(row);
                    return (
                      <tr
                        key={id}
                        tabIndex={onRowActivate ? 0 : undefined}
                        onClick={onRowActivate ? () => onRowActivate(row) : undefined}
                        onKeyDown={
                          onRowActivate
                            ? (e: React.KeyboardEvent) => {
                                if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                                  e.preventDefault();
                                  onRowActivate(row);
                                }
                              }
                            : undefined
                        }
                        className={cx('border-b border-line last:border-b-0', onRowActivate && 'cursor-pointer hover:bg-subtle focus-visible:bg-subtle')}
                      >
                        {columns.map((c) => (
                          <td key={c.key} className={cx('align-middle text-fg2', cellPad, c.align === 'right' && 'text-right', hide(c), c.className)}>
                            {c.cell(row)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
            </tbody>
          </table>
          {!loading && rows.length === 0 && <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />}
        </div>
      )}

      {!error && rows.length > pageSize && (
        <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs text-muted">
          <span aria-live="polite">
            {pg.from}-{pg.to} of {pg.total}
          </span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" disabled={pg.page <= 1} onClick={() => setPage(pg.page - 1)} aria-label="Previous page">
              Previous
            </Button>
            <span className="px-1">
              Page {pg.page} of {pg.pageCount}
            </span>
            <Button size="sm" variant="ghost" disabled={pg.page >= pg.pageCount} onClick={() => setPage(pg.page + 1)} aria-label="Next page">
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
