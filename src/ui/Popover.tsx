import React, { useEffect, useId, useRef, useState } from 'react';
import { cx } from './cx.ts';

/** Button + floating panel. Closes on outside click and Escape; focus returns to the button. */
export const Popover: React.FC<{
  label: string;
  trigger: React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: 'left' | 'right';
  panelClassName?: string;
  buttonClassName?: string;
  onOpenChange?: (open: boolean) => void;
  role?: 'dialog' | 'menu';
}> = ({ label, trigger, children, align = 'right', panelClassName, buttonClassName, onOpenChange, role = 'dialog' }) => {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);
  const btn = useRef<HTMLButtonElement | null>(null);
  const id = useId();
  const set = (v: boolean) => {
    setOpen(v);
    onOpenChange?.(v);
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) set(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        set(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={wrap} className="relative">
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-haspopup={role}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => set(!open)}
        className={cx('inline-flex h-9 items-center gap-2 rounded-md px-2 text-sm text-fg2 transition-colors hover:bg-subtle hover:text-fg', buttonClassName)}
      >
        {trigger}
      </button>
      {open && (
        <div id={id} role={role} aria-label={label} className={cx('ui-pop absolute top-full z-50 mt-1 rounded-lg border border-line-strong bg-surface shadow-e3', align === 'right' ? 'right-0' : 'left-0', panelClassName ?? 'w-72')}>
          {typeof children === 'function' ? children(() => set(false)) : children}
        </div>
      )}
    </div>
  );
};
