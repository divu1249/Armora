import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cx } from './cx.ts';

export const CodeBlock: React.FC<{ code: string; language?: string; label?: string; maxHeight?: string; className?: string }> = ({ code, language, label, maxHeight = 'max-h-80', className }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (insecure context): the text stays selectable */
    }
  };
  return (
    <div className={cx('overflow-hidden rounded-md border border-line bg-code', className)}>
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="font-mono text-2xs text-code-muted">{label ?? language ?? 'text'}</span>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs text-code-fg hover:bg-white/10" aria-label={`Copy ${label ?? 'code'}`}>
          {copied ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre tabIndex={0} className={cx('overflow-auto p-3 font-mono text-xs leading-relaxed text-code-fg whitespace-pre', maxHeight)}>
        <code>{code}</code>
      </pre>
    </div>
  );
};
