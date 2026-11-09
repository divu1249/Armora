import React, { Suspense } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { BRAND } from '../../brand.ts';
import { Logo } from '../../ui/Logo.tsx';
import { ButtonLink, Button } from '../../ui/Button.tsx';
import { useTheme } from '../../app/Theme.tsx';
import { ErrorBoundary } from '../../components/ErrorBoundary.tsx';
import { cx } from '../../ui/cx.ts';
import { PageSkeleton } from '../../ui/Skeleton.tsx';

const link = ({ isActive }: { isActive: boolean }) => cx('rounded-md px-3 py-1.5 text-sm font-medium transition-colors', isActive ? 'text-fg' : 'text-muted hover:text-fg');

export const PublicLayout: React.FC = () => {
  const { theme, toggle } = useTheme();
  return (
    <div className="min-h-screen bg-canvas text-fg">
      <a href="#content" className="sr-only-focusable fixed left-2 top-2 z-[80] rounded-md bg-accent-solid px-3 py-2 text-sm font-medium text-on-solid">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 md:px-6">
          <Link to="/" aria-label={`${BRAND.name} home`} className="mr-4 rounded-md">
            <Logo />
          </Link>
          <nav aria-label="Primary" className="flex flex-1 items-center gap-1">
            <NavLink to="/pricing" className={link}>
              Pricing
            </NavLink>
            <NavLink to="/docs" className={link}>
              Docs
            </NavLink>
            <a href={BRAND.repoUrl} target="_blank" rel="noreferrer noopener" className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-fg sm:block">
              Source
            </a>
          </nav>
          <Button variant="ghost" size="sm" className="px-2" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
            {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
          </Button>
          <ButtonLink to="/app/overview" variant="primary" size="sm">
            Open live demo
          </ButtonLink>
        </div>
      </header>
      <main id="content" tabIndex={-1} className="focus:outline-none">
        <ErrorBoundary>
          <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-12"><PageSkeleton /></div>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-4 md:px-6">
          <div className="md:col-span-2">
            <Logo showTagline />
            <p className="mt-3 max-w-sm text-sm text-muted">A working prototype. The demo uses synthetic data and a simulated agent. Every component says whether it is built, a prototype, seeded, precomputed or only planned.</p>
          </div>
          <nav aria-label="Product">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Product</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="text-fg2 hover:text-fg" to="/app/overview">Live demo</Link></li>
              <li><Link className="text-fg2 hover:text-fg" to="/app/real-vs-simulated">Real vs simulated</Link></li>
              <li><Link className="text-fg2 hover:text-fg" to="/pricing">Pricing (illustrative)</Link></li>
            </ul>
          </nav>
          <nav aria-label="Resources">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Resources</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link className="text-fg2 hover:text-fg" to="/docs">Gateway docs</Link></li>
              <li><a className="text-fg2 hover:text-fg" href={BRAND.repoUrl} target="_blank" rel="noreferrer noopener">Source code</a></li>
            </ul>
          </nav>
        </div>
        <div className="border-t border-line py-4 text-center text-xs text-muted">{BRAND.name} · {BRAND.tagline} · Prototype, synthetic data</div>
      </footer>
    </div>
  );
};
