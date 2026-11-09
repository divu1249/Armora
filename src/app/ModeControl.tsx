import React, { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { FirewallMode } from '../../server/types.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { Button } from '../ui/Button.tsx';
import { Tooltip } from '../ui/Tooltip.tsx';
import { cx } from '../ui/cx.ts';
import { useAppData } from './AppData.tsx';
import { useToast } from '../ui/Toast.tsx';

const MODES: Array<{ id: FirewallMode; label: string; hint: string }> = [
  { id: 'off', label: 'Off', hint: 'No gate. Runs use the legacy-pattern simulation (a standing key). Demo only.' },
  { id: 'shadow', label: 'Shadow', hint: 'The gate decides and logs what it would block, but lets calls through.' },
  { id: 'enforce', label: 'Enforce', hint: 'The gate blocks or holds calls that break policy.' },
];

/** Protection mode: Off / Shadow / Enforce. Switching to Off needs an explicit confirmation. */
export const ModeControl: React.FC = () => {
  const { mode, setMode } = useAppData();
  const { toast } = useToast();
  const [confirmOff, setConfirmOff] = useState(false);

  const choose = (m: FirewallMode) => {
    if (m === mode) return;
    if (m === 'off') {
      setConfirmOff(true);
      return;
    }
    setMode(m);
    toast({ title: `Protection mode: ${m === 'enforce' ? 'Enforce' : 'Shadow'}`, description: MODES.find((x) => x.id === m)?.hint, tone: 'info' });
  };

  return (
    <>
      <div role="radiogroup" aria-label="Protection mode" className="inline-flex rounded-md border border-line-strong bg-subtle p-0.5">
        {MODES.map((m) => {
          const active = m.id === mode;
          return (
            <Tooltip key={m.id} content={m.hint} side="bottom">
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => choose(m.id)}
                className={cx(
                  'h-7 rounded px-3 text-xs font-medium transition-colors',
                  active ? (m.id === 'off' ? 'bg-danger-solid text-on-solid' : m.id === 'shadow' ? 'bg-warn-solid text-on-solid' : 'bg-accent-solid text-on-solid') : 'text-muted hover:text-fg'
                )}
              >
                {m.label}
              </button>
            </Tooltip>
          );
        })}
      </div>

      <Dialog
        open={confirmOff}
        onClose={() => setConfirmOff(false)}
        title="Turn protection off?"
        size="md"
        footer={
          <>
            <Button data-autofocus onClick={() => setConfirmOff(false)}>
              Keep protection on
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setMode('off');
                setConfirmOff(false);
                toast({ title: 'Protection is Off', description: 'New runs bypass the gate (legacy-pattern simulation).', tone: 'warn' });
              }}
            >
              Turn protection off
            </Button>
          </>
        }
      >
        <div className="flex gap-3">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden="true" />
          <div className="space-y-2 text-sm text-fg2">
            <p>
              In <strong>Off</strong> mode the action gate is skipped. A tricked agent&apos;s tool calls run with a standing key that has no limits and never expires. This is the <em>Simulation of the legacy pattern</em>: it is here so you can see what happens without Armora.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-muted">
              <li>Harmful calls in the demo scenarios will actually execute against the demo tool server (synthetic data only).</li>
              <li>Nothing is blocked, held for approval, or rewritten.</li>
              <li>The real tool server never accepts the standing key; this only affects demo runs started from this app.</li>
            </ul>
            <p className="text-muted">Use Shadow instead if you want to see what Armora would block without changing behavior.</p>
          </div>
        </div>
      </Dialog>
    </>
  );
};
