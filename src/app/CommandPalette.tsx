import React, { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { Command, pageCommands, searchCommands } from '../lib/nav.ts';
import { useOverlay } from '../ui/overlay.ts';
import { cx } from '../ui/cx.ts';
import { useAppData } from './AppData.tsx';
import { useTheme } from './Theme.tsx';

const KIND_LABEL: Record<Command['kind'], string> = { page: 'Go to', incident: 'Incident', action: 'Action' };

/** Ctrl/Cmd+K: jump to pages and incidents or run an action. */
export const CommandPalette: React.FC = () => {
  const { paletteOpen, setPaletteOpen, incidents, setRunnerOpen, setTourOpen, setShortcutsOpen, resetDemo, setMode, mode } = useAppData();
  const { toggle } = useTheme();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const close = () => setPaletteOpen(false);
  const ref = useOverlay(paletteOpen, close);

  const commands = useMemo<Command[]>(() => {
    const actions: Command[] = [
      { id: 'action:run', label: 'Run a scenario', hint: 'Replay an attack against a protected app', kind: 'action', keywords: ['simulate', 'attack', 'start'] },
      { id: 'action:tour', label: 'Start the 3-minute walkthrough', hint: 'Guided demo', kind: 'action', keywords: ['demo', 'tour', 'guide'] },
      { id: 'action:theme', label: 'Toggle light / dark theme', hint: 'Appearance', kind: 'action', keywords: ['theme', 'dark', 'light'] },
      { id: 'action:shortcuts', label: 'Keyboard shortcuts', hint: 'Show the cheat-sheet', kind: 'action', keywords: ['help', 'keys', '?'] },
      { id: 'action:reset', label: 'Reset demo data', hint: 'Archives logs and starts a fresh audit chain', kind: 'action', keywords: ['clear', 'genesis'] },
      ...(mode !== 'enforce' ? [{ id: 'action:enforce', label: 'Set protection mode to Enforce', hint: 'Block or hold calls that break policy', kind: 'action' as const, keywords: ['mode', 'protect'] }] : []),
      ...(mode !== 'shadow' ? [{ id: 'action:shadow', label: 'Set protection mode to Shadow', hint: 'Log what would be blocked', kind: 'action' as const, keywords: ['mode', 'observe'] }] : []),
    ];
    const inc: Command[] = incidents.slice(0, 50).map((i) => ({
      id: `incident:${i.id}`,
      label: i.scenarioTitle,
      hint: `${i.decision.action} · ${i.decision.ruleId} · ${i.id}`,
      kind: 'incident' as const,
      path: `/app/incidents/${i.id}`,
      keywords: [i.id, i.decision.ruleId, i.appName ?? '', i.firewallMode],
    }));
    return [...pageCommands(), ...actions, ...inc];
  }, [incidents, mode]);

  const results = useMemo(() => searchCommands(query, commands, 12), [query, commands]);
  useEffect(() => setActive(0), [query, paletteOpen]);
  useEffect(() => {
    if (!paletteOpen) setQuery('');
  }, [paletteOpen]);

  const run = (c: Command) => {
    close();
    if (c.path) return navigate(c.path);
    if (c.id === 'action:run') setRunnerOpen(true);
    else if (c.id === 'action:tour') setTourOpen(true);
    else if (c.id === 'action:theme') toggle();
    else if (c.id === 'action:shortcuts') setShortcutsOpen(true);
    else if (c.id === 'action:reset') void resetDemo();
    else if (c.id === 'action:enforce') setMode('enforce');
    else if (c.id === 'action:shadow') setMode('shadow');
  };

  if (!paletteOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[65] flex items-start justify-center p-4 pt-[12vh]">
      <div className="ui-fade absolute inset-0 bg-black/60" onClick={close} aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Command palette" tabIndex={-1} className="ui-pop relative w-full max-w-xl overflow-hidden rounded-lg border border-line-strong bg-surface shadow-e3">
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search className="h-4 w-4 text-muted" aria-hidden="true" />
          <input
            data-autofocus
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            aria-label="Search pages, incidents and actions"
            placeholder="Search pages, incidents and actions"
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(results.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter' && results[active]) {
                e.preventDefault();
                run(results[active]);
              }
            }}
            className="h-12 w-full bg-transparent text-sm text-fg placeholder:text-muted focus:outline-none"
          />
          <kbd className="rounded border border-line-strong px-1.5 py-0.5 font-mono text-2xs text-muted">Esc</kbd>
        </div>
        <ul id={listId} role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto p-1">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">No matches for &ldquo;{query}&rdquo;</li>}
          {results.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseMove={() => setActive(i)}
              onClick={() => run(c)}
              className={cx('flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm', i === active ? 'bg-subtle text-fg' : 'text-fg2')}
            >
              <span className="w-16 shrink-0 text-2xs font-medium uppercase tracking-wide text-muted">{KIND_LABEL[c.kind]}</span>
              <span className="min-w-0 flex-1 truncate">{c.label}</span>
              <span className="hidden max-w-[40%] truncate text-2xs text-muted sm:block">{c.hint}</span>
              {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-muted" aria-hidden="true" />}
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  );
};
