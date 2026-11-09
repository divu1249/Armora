import React from 'react';

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; description?: React.ReactNode; action?: React.ReactNode }> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
    {icon && (
      <div aria-hidden="true" className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-subtle text-muted">
        {icon}
      </div>
    )}
    <h3 className="text-sm font-semibold text-fg">{title}</h3>
    {description && <p className="max-w-md text-sm text-muted">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);
