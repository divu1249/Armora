import React, { useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useOverlay } from './overlay.ts';
import { Button } from './Button.tsx';

export const Drawer: React.FC<{ open: boolean; onClose: () => void; title: string; description?: string; children?: React.ReactNode }> = ({ open, onClose, title, description, children }) => {
  const titleId = useId();
  const ref = useOverlay(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div className="ui-fade absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <aside ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="ui-slide absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-line-strong bg-surface shadow-e3">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-base font-semibold text-fg">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close panel" className="-mr-2 px-2">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>,
    document.body
  );
};
