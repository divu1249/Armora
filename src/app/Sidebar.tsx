import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NAV_GROUPS, NavItem, SETTINGS_ITEM } from '../lib/nav.ts';
import { NAV_ICONS } from '../ui/icons.ts';
import { Logo, LogoMark } from '../ui/Logo.tsx';
import { Tooltip } from '../ui/Tooltip.tsx';
import { cx } from '../ui/cx.ts';
import { BRAND } from '../brand.ts';

const itemClass = (active: boolean, collapsed: boolean) =>
  cx(
    'group relative flex h-9 items-center gap-3 rounded-md text-sm font-medium transition-colors',
    collapsed ? 'justify-center px-0' : 'px-3',
    active ? 'bg-subtle text-fg' : 'text-muted hover:bg-subtle hover:text-fg'
  );

const SidebarItem: React.FC<{ item: NavItem; collapsed: boolean; badge?: number; onNavigate?: () => void }> = ({ item, collapsed, badge, onNavigate }) => {
  const Icon = NAV_ICONS[item.icon];
  return (
    <NavLink to={item.path} onClick={onNavigate} aria-label={collapsed ? item.label : undefined} className={({ isActive }: { isActive: boolean }) => itemClass(isActive, collapsed)}>
      {({ isActive }: { isActive: boolean }) => (
        <>
          {isActive && <span aria-hidden="true" className="absolute left-0 top-2 h-5 w-0.5 rounded-full bg-accent-solid" />}
          {Icon && <Icon className={cx('h-4 w-4 shrink-0', isActive && 'text-accent')} aria-hidden="true" />}
          {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
          {badge ? (
            <span className={cx('tabular rounded-full bg-warn-solid px-1.5 text-2xs font-semibold leading-4 text-on-solid', collapsed && 'absolute right-1 top-1 px-1')} aria-label={`${badge} pending`}>
              {badge}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );
};

export const Sidebar: React.FC<{ collapsed: boolean; onToggle: () => void; badges?: Record<string, number>; mobile?: boolean; onNavigate?: () => void }> = ({ collapsed, onToggle, badges = {}, mobile, onNavigate }) => {
  const narrow = collapsed && !mobile;
  return (
    <nav aria-label="Main" className={cx('flex h-full flex-col border-r border-line bg-surface', narrow ? 'w-16' : 'w-60')}>
      <div className={cx('flex h-14 shrink-0 items-center border-b border-line', narrow ? 'justify-center' : 'px-4')}>
        <Link to="/" aria-label={`${BRAND.name} home`} className="rounded-md">
          {narrow ? <LogoMark /> : <Logo showTagline />}
        </Link>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((g) => (
          <div key={g.id} role="group" aria-labelledby={`nav-${g.id}`}>
            <p id={`nav-${g.id}`} className={cx('mb-1 px-3 text-2xs font-semibold uppercase tracking-wider text-muted', narrow && 'sr-only')}>
              {g.label}
            </p>
            {narrow && <div aria-hidden="true" className="mx-3 mb-1 border-t border-line" />}
            <div className="space-y-0.5">
              {g.items.map((it) =>
                narrow ? (
                  <Tooltip key={it.id} content={it.label} side="top" className="flex w-full">
                    <span className="w-full">
                      <SidebarItem item={it} collapsed badge={badges[it.id]} onNavigate={onNavigate} />
                    </span>
                  </Tooltip>
                ) : (
                  <SidebarItem key={it.id} item={it} collapsed={false} badge={badges[it.id]} onNavigate={onNavigate} />
                )
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-0.5 border-t border-line px-2 py-2">
        <SidebarItem item={SETTINGS_ITEM} collapsed={narrow} onNavigate={onNavigate} />
        {!mobile && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className={cx('flex h-9 w-full items-center gap-3 rounded-md text-sm text-muted transition-colors hover:bg-subtle hover:text-fg', narrow ? 'justify-center' : 'px-3')}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
            {!narrow && <span>Collapse</span>}
          </button>
        )}
      </div>
    </nav>
  );
};
