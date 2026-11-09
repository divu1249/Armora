import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Building2, Check, KeyRound, Keyboard, Menu as MenuIcon, Moon, Play, Search, Settings, Sparkles, Sun, User } from 'lucide-react';
import { BRAND } from '../brand.ts';
import { Button } from '../ui/Button.tsx';
import { Badge } from '../ui/Badge.tsx';
import { Dialog } from '../ui/Dialog.tsx';
import { Field, Input } from '../ui/fields.tsx';
import { Menu } from '../ui/Menu.tsx';
import { Popover } from '../ui/Popover.tsx';
import { timeAgo } from '../lib/format.ts';
import { getAdminToken, setAdminToken } from '../services/api.ts';
import { useAppData } from './AppData.tsx';
import { useTheme } from './Theme.tsx';
import { ModeControl } from './ModeControl.tsx';
import { useToast } from '../ui/Toast.tsx';

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

export const TopBar: React.FC<{ onOpenMobileNav: () => void }> = ({ onOpenMobileNav }) => {
  const { notifications, unread, markNotificationsSeen, setPaletteOpen, setRunnerOpen, setTourOpen, setShortcutsOpen, config } = useAppData();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tokenOpen, setTokenOpen] = useState(false);
  const [token, setToken] = useState(getAdminToken());

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur md:px-4">
      <Button variant="ghost" size="sm" className="px-2 md:hidden" onClick={onOpenMobileNav} aria-label="Open navigation">
        <MenuIcon className="h-4 w-4" aria-hidden="true" />
      </Button>

      {/* organization + environment */}
      <Menu
        label="Organization and environment"
        align="left"
        width="w-72"
        trigger={
          <>
            <Building2 className="h-4 w-4 text-muted" aria-hidden="true" />
            <span className="hidden max-w-[11rem] truncate font-medium text-fg lg:inline">{BRAND.organization}</span>
            <Badge tone="accent">Demo</Badge>
          </>
        }
        items={[
          { id: 'org', section: 'Organization', label: BRAND.organization, checked: true },
          { id: 'env-demo', section: 'Environment', label: 'Demo', hint: 'this server', checked: true },
          { id: 'env-staging', label: 'Staging', hint: 'ROADMAP', disabled: true },
          { id: 'env-prod', label: 'Production', hint: 'ROADMAP', disabled: true },
        ]}
      />

      <span className="hidden xl:block" title={BRAND.demoBadge}>
        <Badge tone="warn" dot>
          {BRAND.demoBadge}
        </Badge>
      </span>

      <div className="flex-1" />

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="hidden h-9 min-w-[14rem] items-center gap-2 rounded-md border border-line-strong bg-subtle px-3 text-sm text-muted transition-colors hover:text-fg sm:flex lg:min-w-[18rem]"
        aria-label="Search and command palette"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="flex-1 text-left">Search or jump to…</span>
        <kbd className="rounded border border-line-strong bg-surface px-1.5 font-mono text-2xs">{isMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>
      <Button variant="ghost" size="sm" className="px-2 sm:hidden" onClick={() => setPaletteOpen(true)} aria-label="Search">
        <Search className="h-4 w-4" aria-hidden="true" />
      </Button>

      <ModeControl />

      <Button variant="secondary" size="sm" onClick={() => setRunnerOpen(true)} leftIcon={<Play className="h-3.5 w-3.5" aria-hidden="true" />} className="hidden lg:inline-flex">
        Run scenario
      </Button>

      <Popover
        label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        onOpenChange={(o: boolean) => o && markNotificationsSeen()}
        panelClassName="w-80"
        trigger={
          <span className="relative">
            <Bell className="h-4 w-4" aria-hidden="true" />
            {unread > 0 && <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-danger-solid px-1 text-center text-2xs font-semibold leading-4 text-on-solid">{unread > 9 ? '9+' : unread}</span>}
          </span>
        }
      >
        {(close: () => void) => (
          <div>
            <p className="border-b border-line px-3 py-2 text-xs font-semibold text-fg">Notifications</p>
            <ul className="max-h-80 overflow-y-auto">
              {notifications.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Nothing needs your attention.</li>}
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link to={n.to} onClick={close} className="flex flex-col gap-0.5 border-b border-line px-3 py-2 last:border-b-0 hover:bg-subtle">
                    <span className="flex items-center justify-between gap-2 text-sm font-medium text-fg">
                      <span className="truncate">{n.title}</span>
                      <span className="shrink-0 text-2xs font-normal text-muted">{timeAgo(n.ts)}</span>
                    </span>
                    <span className="truncate text-xs text-muted">{n.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Popover>

      <Button variant="ghost" size="sm" className="px-2" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
        {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
      </Button>

      <Menu
        label="User menu"
        width="w-64"
        trigger={
          <>
            <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-solid text-on-solid">
              <User className="h-3.5 w-3.5" />
            </span>
          </>
        }
        items={[
          { id: 'who', section: 'Signed in as', label: 'Demo user', hint: 'mock' },
          { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" />, onSelect: () => navigate('/app/settings') },
          { id: 'tour', label: '3-minute walkthrough', icon: <Sparkles className="h-4 w-4" />, onSelect: () => setTourOpen(true) },
          { id: 'keys', label: 'Keyboard shortcuts', icon: <Keyboard className="h-4 w-4" />, hint: '?', onSelect: () => setShortcutsOpen(true) },
          { id: 'token', label: 'Admin token…', icon: <KeyRound className="h-4 w-4" />, hint: config?.adminTokenRequired ? 'required' : 'optional', onSelect: () => setTokenOpen(true) },
          { id: 'home', label: 'Product site', onSelect: () => navigate('/') },
        ]}
      />

      <Dialog
        open={tokenOpen}
        onClose={() => setTokenOpen(false)}
        title="Admin token"
        description="Needed for actions that change state (approvals, policy, resets) when the server runs in production. It is kept in this tab's session storage only and never shown again."
        footer={
          <>
            <Button onClick={() => setTokenOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              leftIcon={<Check className="h-4 w-4" aria-hidden="true" />}
              onClick={() => {
                setAdminToken(token.trim());
                setTokenOpen(false);
                setToken('');
                toast({ title: token.trim() ? 'Admin token saved for this tab' : 'Admin token cleared', tone: 'ok' });
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <Field label="Token" hint={config?.adminTokenRequired ? 'This server requires a token for write actions.' : 'This server does not require a token (not in production mode).'}>
          {(id: string) => <Input id={id} data-autofocus type="password" autoComplete="off" value={token} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToken(e.target.value)} placeholder="Paste token" />}
        </Field>
      </Dialog>
    </header>
  );
};


