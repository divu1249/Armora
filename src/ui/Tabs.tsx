import React, { useId, useRef, useState } from 'react';
import { cx } from './cx.ts';

export interface TabDef {
  id: string;
  label: React.ReactNode;
  content: React.ReactNode;
  badge?: React.ReactNode;
}

/** Accessible tabs: roving tabindex, Arrow/Home/End keys, only the active panel is rendered. */
export const Tabs: React.FC<{ tabs: TabDef[]; value?: string; onChange?: (id: string) => void; defaultValue?: string; label: string; className?: string }> = ({ tabs, value, onChange, defaultValue, label, className }) => {
  const baseId = useId();
  const [inner, setInner] = useState(defaultValue ?? tabs[0]?.id);
  const active = value ?? inner;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const select = (id: string) => {
    setInner(id);
    onChange?.(id);
  };
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    select(tabs[next].id);
    refs.current[next]?.focus();
  };
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div className={className}>
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t, i) => {
          const selected = t.id === current.id;
          return (
            <button
              key={t.id}
              ref={(el: HTMLButtonElement | null) => {
                refs.current[i] = el;
              }}
              role="tab"
              type="button"
              id={`${baseId}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(t.id)}
              onKeyDown={(e: React.KeyboardEvent) => onKeyDown(e, i)}
              className={cx(
                'relative -mb-px inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors',
                selected ? 'border-accent-solid text-fg' : 'border-transparent text-muted hover:text-fg'
              )}
            >
              {t.label}
              {t.badge}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${baseId}-panel-${current.id}`} aria-labelledby={`${baseId}-tab-${current.id}`} tabIndex={0} className="pt-4">
        {current.content}
      </div>
    </div>
  );
};
