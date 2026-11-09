import React from 'react';
import { Dialog } from '../ui/Dialog.tsx';
import { Button } from '../ui/Button.tsx';

const ROWS: Array<[string, string]> = [
  ['Ctrl/⌘ K', 'Open the command palette'],
  ['g then o', 'Overview'],
  ['g then l', 'Live feed'],
  ['g then i', 'Incidents'],
  ['g then p', 'Policies'],
  ['g then c', 'Credentials'],
  ['g then q', 'Approvals (queue)'],
  ['g then a', 'Audit'],
  ['g then r', 'Red team'],
  ['g then s', 'With vs without (split screen)'],
  ['g then m', 'Real vs simulated'],
  ['g then d', 'Start the 3-minute walkthrough'],
  ['?', 'Show this list'],
  ['Esc', 'Close the open dialog or menu'],
];

export const KeyboardShortcutsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => (
  <Dialog open={isOpen} onClose={onClose} title="Keyboard shortcuts" description="Shortcuts are ignored while you type in a field." footer={<Button onClick={onClose}>Close</Button>}>
    <dl className="divide-y divide-line">
      {ROWS.map(([k, d]) => (
        <div key={k} className="flex items-center justify-between gap-4 py-2 text-sm">
          <dt className="text-fg2">{d}</dt>
          <dd>
            <kbd className="rounded border border-line-strong bg-subtle px-2 py-0.5 font-mono text-xs text-fg">{k}</kbd>
          </dd>
        </div>
      ))}
    </dl>
  </Dialog>
);
