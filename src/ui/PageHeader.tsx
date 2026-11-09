import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface Crumb {
  label: string;
  to?: string;
}

export const PageHeader: React.FC<{ title: string; description?: React.ReactNode; breadcrumbs?: Crumb[]; actions?: React.ReactNode; badges?: React.ReactNode }> = ({ title, description, breadcrumbs, actions, badges }) => (
  <header className="mb-6">
    {breadcrumbs && breadcrumbs.length > 0 && (
      <nav aria-label="Breadcrumb" className="mb-2">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
          {breadcrumbs.map((c, i) => (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1">
              {c.to ? (
                <Link to={c.to} className="hover:text-fg hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-fg2">
                  {c.label}
                </span>
              )}
              {i < breadcrumbs.length - 1 && <ChevronRight className="h-3 w-3" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      </nav>
    )}
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
          {badges}
        </div>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  </header>
);
