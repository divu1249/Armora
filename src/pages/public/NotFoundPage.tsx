import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ButtonLink } from '../../ui/Button.tsx';
import { BRAND } from '../../brand.ts';

export default function NotFoundPage({ inApp }: { inApp?: boolean }) {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = `Page not found · ${BRAND.name}`;
  }, []);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <p className="font-mono text-sm text-accent">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-fg">We could not find that page</h1>
      <p className="mt-2 text-sm text-muted">
        <code className="font-mono text-xs">{pathname}</code> does not exist. It may have moved, or the link may be mistyped.
      </p>
      <div className="mt-6 flex gap-2">
        <ButtonLink to={inApp ? '/app/overview' : '/'} variant="primary">
          {inApp ? 'Go to the overview' : 'Go to the home page'}
        </ButtonLink>
        {inApp && <ButtonLink to="/app/incidents">See incidents</ButtonLink>}
      </div>
    </div>
  );
}
