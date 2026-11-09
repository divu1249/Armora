import React from 'react';
import { BRAND } from '../brand.ts';
import { cx } from './cx.ts';

/** Simple shield mark. Decorative when next to the wordmark. */
export const LogoMark: React.FC<{ className?: string; title?: string }> = ({ className, title }) => (
  <svg viewBox="0 0 32 32" className={cx('h-6 w-6', className)} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
    <path d="M16 2.5 5 6.5v8.2c0 6.6 4.5 12.2 11 14.8 6.5-2.6 11-8.2 11-14.8V6.5L16 2.5Z" fill="var(--c-accent-solid)" />
    <path d="M11 16.5 14.5 20 21.5 12" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Logo: React.FC<{ className?: string; showTagline?: boolean }> = ({ className, showTagline }) => (
  <span className={cx('inline-flex items-center gap-2', className)}>
    <LogoMark />
    <span className="flex flex-col leading-none">
      <span className="text-sm font-semibold tracking-tight text-fg">{BRAND.name}</span>
      {showTagline && <span className="mt-0.5 text-2xs text-muted">{BRAND.tagline}</span>}
    </span>
  </span>
);
