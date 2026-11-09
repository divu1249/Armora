import React from 'react';
import { Link } from 'react-router-dom';
import { cx } from './cx.ts';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap select-none transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none';
const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent-solid text-on-solid hover:brightness-110',
  secondary: 'bg-surface text-fg border border-line-strong hover:bg-subtle',
  ghost: 'text-fg2 hover:bg-subtle hover:text-fg',
  danger: 'bg-danger-solid text-on-solid hover:brightness-110',
};
const sizes: Record<ButtonSize, string> = { sm: 'h-8 px-3 text-xs', md: 'h-9 px-4 text-sm', lg: 'h-11 px-6 text-sm' };

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ variant = 'secondary', size = 'md', loading, leftIcon, className, children, disabled, type = 'button', ...rest }) => (
  <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={cx(base, variants[variant], sizes[size], className)} {...rest}>
    {loading ? <span aria-hidden="true" className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" /> : leftIcon}
    {children}
  </button>
);

export interface ButtonLinkProps {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  leftIcon?: React.ReactNode;
  children?: React.ReactNode;
  external?: boolean;
}

export const ButtonLink: React.FC<ButtonLinkProps> = ({ to, variant = 'secondary', size = 'md', className, leftIcon, children, external }) => {
  const cls = cx(base, variants[variant], sizes[size], className);
  if (external) {
    return (
      <a href={to} className={cls} target="_blank" rel="noreferrer noopener">
        {leftIcon}
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={cls}>
      {leftIcon}
      {children}
    </Link>
  );
};
