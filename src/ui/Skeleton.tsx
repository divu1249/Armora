import React from 'react';
import { cx } from './cx.ts';

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => <div aria-hidden="true" className={cx('skeleton rounded-md', className)} />;

export const PageSkeleton: React.FC = () => (
  <div role="status" aria-label="Loading page" className="space-y-4">
    <Skeleton className="h-8 w-64" />
    <Skeleton className="h-4 w-96 max-w-full" />
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
    <Skeleton className="h-64" />
  </div>
);
