import React, { useId, useState } from 'react';
import { GLOSSARY } from '../lib/glossary.ts';
import { cx } from './cx.ts';

/** Accessible tooltip: shown on hover and keyboard focus, hidden with Escape, linked with aria-describedby. */
export const Tooltip: React.FC<{ content: React.ReactNode; children: React.ReactNode; side?: 'top' | 'bottom'; className?: string }> = ({ content, children, side = 'top', className }) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className={cx('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e: React.KeyboardEvent) => e.key === 'Escape' && setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cx(
            'ui-fade absolute left-1/2 z-50 w-max max-w-[260px] -translate-x-1/2 rounded-md border border-line-strong bg-raised px-2 py-1 text-2xs font-normal normal-case leading-snug tracking-normal text-fg shadow-e2 pointer-events-none',
            side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
};

/** Jargon with a plain-language explanation. Focusable so keyboard users get it too. */
export const Term: React.FC<{ term: string; children?: React.ReactNode }> = ({ term, children }) => {
  const explanation = GLOSSARY[term];
  if (!explanation) return <>{children ?? term}</>;
  return (
    <Tooltip content={explanation}>
      <span tabIndex={0} className="cursor-help border-b border-dotted border-muted">
        {children ?? term}
      </span>
    </Tooltip>
  );
};
