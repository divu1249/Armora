import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import { cx } from './cx.ts';

export type ToastTone = 'ok' | 'info' | 'warn' | 'danger';
export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
}
interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<{ toast: (t: ToastInput) => void }>({ toast: () => undefined });
export const useToast = () => useContext(ToastContext);

const ICON = { ok: CheckCircle2, info: Info, warn: TriangleAlert, danger: XCircle };
const COLOR = { ok: 'text-ok', info: 'text-accent', warn: 'text-warn', danger: 'text-danger' };

export const ToastProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((p) => p.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (t: ToastInput) => {
      const id = Date.now() + Math.random();
      setItems((p) => [...p.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), t.tone === 'danger' ? 8000 : 5000);
    },
    [dismiss]
  );
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {items.map((t) => {
          const tone = t.tone ?? 'info';
          const Icon = ICON[tone];
          return (
            <div key={t.id} role="status" className="ui-pop pointer-events-auto flex items-start gap-3 rounded-lg border border-line-strong bg-raised p-3 shadow-e2">
              <Icon className={cx('mt-0.5 h-4 w-4 shrink-0', COLOR[tone])} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="rounded p-1 text-muted hover:bg-subtle hover:text-fg">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
