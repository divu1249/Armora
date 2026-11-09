import React, { useId } from 'react';
import { cx } from './cx.ts';

const control =
  'h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-fg placeholder:text-muted transition-colors hover:border-faint disabled:opacity-50';

export const Field: React.FC<{ label: string; hint?: string; error?: string; children: (id: string) => React.ReactNode; className?: string }> = ({ label, hint, error, children, className }) => {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-fg2">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-muted">{hint}</p>
      )}
    </div>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...rest }) => <input className={cx(control, className)} {...rest} />;
export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, ...rest }) => (
  <select className={cx(control, 'pr-8', className)} {...rest}>
    {children}
  </select>
);
export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className, ...rest }) => (
  <textarea className={cx(control, 'h-auto py-2 font-mono text-xs leading-relaxed', className)} {...rest} />
);

/** Toggle switch (role="switch"). The visible label is required for accessibility. */
export const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hideLabel?: boolean; disabled?: boolean }> = ({ checked, onChange, label, hideLabel, disabled }) => (
  <label className={cx('inline-flex items-center gap-2 text-sm text-fg2', disabled && 'opacity-50')}>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={hideLabel ? label : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150', checked ? 'bg-accent-solid' : 'bg-faint')}
    >
      <span aria-hidden="true" className={cx('absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-150', checked && 'translate-x-4')} />
    </button>
    {!hideLabel && <span>{label}</span>}
  </label>
);

/** Segmented control (radio group semantics). */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line-strong bg-subtle p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx('h-7 rounded px-3 text-xs font-medium transition-colors', o.value === value ? 'bg-surface text-fg shadow-e1' : 'text-muted hover:text-fg')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
