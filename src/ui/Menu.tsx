import React from 'react';
import { Check } from 'lucide-react';
import { Popover } from './Popover.tsx';
import { cx } from './cx.ts';

export interface MenuItem {
  id: string;
  label: string;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  onSelect?: () => void;
  checked?: boolean;
  disabled?: boolean;
  section?: string;
}

/** Dropdown menu with Arrow-key navigation (role="menu"). */
export const Menu: React.FC<{ label: string; trigger: React.ReactNode; items: MenuItem[]; align?: 'left' | 'right'; width?: string; buttonClassName?: string }> = ({ label, trigger, items, align, width = 'w-64', buttonClassName }) => {
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const list = Array.from((e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'));
    if (list.length === 0) return;
    e.preventDefault();
    const i = list.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : e.key === 'ArrowDown' ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
    list[next].focus();
  };
  return (
    <Popover label={label} trigger={trigger} align={align} panelClassName={cx(width, 'p-1')} buttonClassName={buttonClassName} role="menu">
      {(close: () => void) => (
        <div onKeyDown={onKeyDown}>
          {items.map((it, idx) => (
            <React.Fragment key={it.id}>
              {it.section && items[idx - 1]?.section !== it.section && <p className="px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-muted">{it.section}</p>}
              <button
                type="button"
                role="menuitem"
                disabled={it.disabled}
                onClick={() => {
                  it.onSelect?.();
                  close();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-fg2 hover:bg-subtle hover:text-fg focus-visible:bg-subtle disabled:opacity-50"
              >
                {it.icon && <span aria-hidden="true">{it.icon}</span>}
                <span className="min-w-0 flex-1 truncate">{it.label}</span>
                {it.hint && <span className="shrink-0 text-2xs text-muted">{it.hint}</span>}
                {it.checked && <Check className="h-3.5 w-3.5 text-accent" aria-label="selected" />}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </Popover>
  );
};
