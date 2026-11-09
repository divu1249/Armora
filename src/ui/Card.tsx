import React from 'react';
import { cx } from './cx.ts';

export const Card: React.FC<{ className?: string; children?: React.ReactNode; as?: 'section' | 'div' | 'article'; 'aria-label'?: string; tone?: 'default' | 'danger' | 'ok' | 'warn' }> = ({
  className,
  children,
  as = 'div',
  tone = 'default',
  ...rest
}) => {
  const Tag = as;
  return (
    <Tag
      className={cx(
        'rounded-lg border bg-surface shadow-e1',
        tone === 'default' && 'border-line',
        tone === 'danger' && 'border-danger/40',
        tone === 'ok' && 'border-ok/40',
        tone === 'warn' && 'border-warn/40',
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
};

export const CardHeader: React.FC<{ title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string; headingLevel?: 2 | 3 }> = ({ title, description, actions, className, headingLevel = 2 }) => {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className={cx('flex items-start justify-between gap-4 border-b border-line px-4 py-3', className)}>
      <div className="min-w-0">
        <H className="text-sm font-semibold text-fg">{title}</H>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
};

export const CardBody: React.FC<{ className?: string; children?: React.ReactNode }> = ({ className, children }) => <div className={cx('p-4', className)}>{children}</div>;
