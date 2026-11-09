import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Sidebar } from './Sidebar.tsx';
import { TopBar } from './TopBar.tsx';
import { CommandPalette } from './CommandPalette.tsx';
import { useAppData } from './AppData.tsx';
import { ErrorBoundary } from '../components/ErrorBoundary.tsx';
import { PageSkeleton } from '../ui/Skeleton.tsx';
import { findNavItem } from '../lib/nav.ts';
import { BRAND } from '../brand.ts';
import { useOverlay } from '../ui/overlay.ts';
import { QuickScenarioRunnerModal } from '../components/QuickScenarioRunnerModal.tsx';
import { DemoTourModal } from '../components/DemoTourModal.tsx';
import { KeyboardShortcutsModal } from '../components/KeyboardShortcutsModal.tsx';

const COLLAPSE_KEY = 'armora.sidebar.collapsed';

/** g-then-key shortcuts (Linear style). */
export const GO_SHORTCUTS: Record<string, string> = {
  o: '/app/overview',
  l: '/app/feed',
  i: '/app/incidents',
  p: '/app/policies',
  c: '/app/credentials',
  q: '/app/approvals',
  a: '/app/audit',
  r: '/app/redteam',
  s: '/app/compare',
  m: '/app/real-vs-simulated',
};

export const AppShell: React.FC = () => {
  const { pending, config, scenarios, mode, runnerOpen, setRunnerOpen, tourOpen, setTourOpen, shortcutsOpen, setShortcutsOpen, setPaletteOpen, addIncident, refresh } = useAppData();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);
  const first = useRef(true);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(COLLAPSE_KEY);
      if (v !== null) return v === '1';
      return typeof window !== 'undefined' && window.innerWidth < 1100;
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [geminiDismissed, setGeminiDismissed] = useState(false);
  const mobileRef = useOverlay(mobileOpen, () => setMobileOpen(false));

  // document title + focus the main region after in-app navigation (screen readers) + scroll to top
  useEffect(() => {
    const item = findNavItem(pathname);
    document.title = `${item ? item.label : pathname.startsWith('/app/incidents/') ? 'Incident' : 'App'} · ${BRAND.name}`;
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => setMobileOpen(false), [pathname]);

  // /app/overview?tour=1 (from the landing page) opens the walkthrough once, then cleans the URL
  useEffect(() => {
    if (new URLSearchParams(search).get('tour') === '1') {
      setTourOpen(true);
      navigate(pathname, { replace: true });
    }
  }, [search, pathname, navigate, setTourOpen]);

  useEffect(() => {
    let lastG = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || t?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '?') {
        setShortcutsOpen(true);
        return;
      }
      const k = e.key.toLowerCase();
      if (Date.now() - lastG < 1000) {
        lastG = 0;
        if (k === 'd') setTourOpen(true);
        else if (GO_SHORTCUTS[k]) navigate(GO_SHORTCUTS[k]);
        return;
      }
      if (k === 'g') lastG = Date.now();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, setPaletteOpen, setShortcutsOpen, setTourOpen]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };
  const badges = useMemo(() => ({ approvals: pending.length }), [pending.length]);
  const geminiBanner = config?.gemini.banner && !geminiDismissed ? config.gemini.banner : null;

  return (
    <div className="flex min-h-screen bg-canvas text-fg">
      <a href="#main" className="sr-only-focusable fixed left-2 top-2 z-[80] rounded-md bg-accent-solid px-3 py-2 text-sm font-medium text-on-solid">
        Skip to main content
      </a>
      <div className="sticky top-0 hidden h-screen shrink-0 md:block">
        <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} badges={badges} />
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="ui-fade absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div ref={mobileRef} role="dialog" aria-modal="true" aria-label="Navigation" tabIndex={-1} className="ui-slide absolute inset-y-0 left-0">
            <Sidebar collapsed={false} mobile onToggle={() => undefined} badges={badges} onNavigate={() => setMobileOpen(false)} />
            <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="absolute right-[-44px] top-3 rounded-md bg-surface p-2 text-fg">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMobileNav={() => setMobileOpen(true)} />
        {geminiBanner && (
          <div role="status" className="flex items-start justify-between gap-3 border-b border-line bg-warn/10 px-4 py-2 text-xs text-fg2">
            <span>
              <strong className="text-warn">Gemini is not in use.</strong> {geminiBanner}
            </span>
            <button type="button" onClick={() => setGeminiDismissed(true)} className="shrink-0 rounded px-1 text-muted hover:text-fg" aria-label="Dismiss Gemini notice">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
        <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 focus:outline-none md:px-6">
          <ErrorBoundary resetKey={pathname}>
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <CommandPalette />
      <QuickScenarioRunnerModal
        isOpen={runnerOpen}
        onClose={() => setRunnerOpen(false)}
        scenarios={scenarios}
        currentMode={mode}
        onRunComplete={(inc) => {
          addIncident(inc);
          setRunnerOpen(false);
          navigate(`/app/incidents/${inc.id}`);
        }}
      />
      <DemoTourModal
        isOpen={tourOpen}
        onClose={() => {
          setTourOpen(false);
          void refresh();
        }}
        scenarios={scenarios}
        onSelectIncident={(id: string) => {
          setTourOpen(false);
          navigate(`/app/incidents/${id}`);
        }}
      />
      <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
};
