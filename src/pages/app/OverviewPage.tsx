import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CircleCheck, Play, X } from 'lucide-react';
import { useAppData } from '../../app/AppData.tsx';
import { computeOverview } from '../../lib/metrics.ts';
import { PageHeader } from '../../ui/PageHeader.tsx';
import { StatTile } from '../../ui/StatTile.tsx';
import { Card, CardBody, CardHeader } from '../../ui/Card.tsx';
import { Badge, StatusChip } from '../../ui/Badge.tsx';
import { Button, ButtonLink } from '../../ui/Button.tsx';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { Skeleton } from '../../ui/Skeleton.tsx';
import { DataTable } from '../../ui/DataTable.tsx';
import { IncidentsTable } from './IncidentsTable.tsx';
import { cx } from '../../ui/cx.ts';

const GOOD: Record<string, 'up' | 'down' | 'neutral'> = { runs: 'neutral', blocked: 'up', held: 'neutral', left: 'down' };

export default function OverviewPage() {
  const { incidents, apps, pending, quarantinedAgents, loading, error, refresh, checklist, checklistDismissed, dismissChecklist, setRunnerOpen, setTourOpen } = useAppData();
  const m = useMemo(() => computeOverview({ incidents, apps, pendingApprovals: pending.length, quarantinedAgents }), [incidents, apps, pending.length, quarantinedAgents]);
  const showChecklist = !checklistDismissed;

  return (
    <>
      <PageHeader
        title="Overview"
        description={`What agents did in the last ${m.windowHours} hours, computed from this instance's own records.`}
        badges={m.seeded > 0 ? <StatusChip kind="SEEDED" /> : undefined}
        actions={
          <>
            <Button onClick={() => setTourOpen(true)}>3-minute walkthrough</Button>
            <Button variant="primary" leftIcon={<Play className="h-4 w-4" aria-hidden="true" />} onClick={() => setRunnerOpen(true)}>
              Run scenario
            </Button>
          </>
        }
      />

      {showChecklist && (
        <Card as="section" aria-label="Getting started" className="mb-6">
          <CardHeader
            title={checklist.complete ? 'Setup complete' : `Get started (${checklist.done} of ${checklist.steps.length})`}
            description={checklist.complete ? 'You have connected an app, run a scenario and reviewed an incident.' : 'Three steps to see Armora work end to end.'}
            actions={
              <Button variant="ghost" size="sm" onClick={dismissChecklist} aria-label="Dismiss getting started checklist">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            }
          />
          <ol className="grid gap-px bg-line md:grid-cols-3">
            {checklist.steps.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 bg-surface p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-fg">
                  <CircleCheck className={cx('h-4 w-4', s.done ? 'text-ok' : 'text-faint')} aria-hidden="true" />
                  {s.title}
                  {s.done && <span className="sr-only">(done)</span>}
                </div>
                <p className="text-xs text-muted">{s.description}</p>
                {!s.done && (
                  <Link to={s.to} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                    {s.cta} <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {error && (
        <Card tone="danger" className="mb-6">
          <CardBody className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-fg">Could not load data from the server</p>
              <p className="text-xs text-muted">{error}</p>
            </div>
            <Button onClick={() => void refresh()}>Try again</Button>
          </CardBody>
        </Card>
      )}

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[7.5rem]" />)
          : m.kpis.map((k) => <StatTile key={k.id} label={k.label} value={k.value} help={k.help} delta={k.delta} goodDirection={GOOD[k.id]} spark={k.spark} />)}
      </section>
      <p className="mt-2 text-2xs text-muted">
        Computed from {m.total} recorded run{m.total === 1 ? '' : 's'} ({m.seeded} seeded sample{m.seeded === 1 ? '' : 's'}). Deltas compare with the previous {m.windowHours} hours; where nothing was recorded then, no percentage is shown.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card as="section" aria-label="Needs attention" className="lg:col-span-2">
          <CardHeader title="Needs attention" description="Things a person should look at, most urgent first." />
          {m.needsAttention.length === 0 ? (
            <EmptyState icon={<CircleCheck className="h-5 w-5" />} title="All clear" description="No pending approvals, no data left the premises, nothing is quarantined." />
          ) : (
            <ul className="divide-y divide-line">
              {m.needsAttention.map((a) => (
                <li key={a.id}>
                  <Link to={a.to} className="flex items-center gap-3 px-4 py-3 hover:bg-subtle">
                    <Badge tone={a.severity === 'danger' ? 'danger' : a.severity === 'warn' ? 'warn' : 'info'}>{a.severity === 'danger' ? 'Urgent' : a.severity === 'warn' ? 'Review' : 'Info'}</Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">{a.title}</span>
                      <span className="block truncate text-xs text-muted">{a.detail}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card as="section" aria-label="Top rules fired">
          <CardHeader title="Top rules fired" description="How often each rule matched a run." />
          {m.topRules.length === 0 ? (
            <EmptyState title="No rules fired yet" description="Rules appear here after the first run." />
          ) : (
            <ul className="space-y-3 p-4">
              {m.topRules.map((r) => (
                <li key={r.ruleId}>
                  <div className="flex items-center justify-between text-xs">
                    <code className="font-mono text-fg2">{r.ruleId}</code>
                    <span className="tabular text-muted">{r.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-subtle" role="presentation">
                    <div className="h-full rounded-full bg-accent-solid" style={{ width: `${Math.max(6, (r.count / m.topRules[0].count) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card as="section" aria-label="Protection coverage" className="mt-6">
        <CardHeader
          title="Protection coverage per app"
          description="Share of each app's recorded runs that went through the gate in Enforce mode. Runs in Shadow or Off are not protected."
          actions={<ButtonLink to="/app/apps" size="sm">Manage apps</ButtonLink>}
        />
        <DataTable
          className="rounded-none border-0"
          caption="Protection coverage per app"
          rows={m.coverage}
          getRowId={(r) => r.appId}
          loading={loading}
          pageSize={10}
          columns={[
            { key: 'app', header: 'App', sortValue: (r) => r.name, cell: (r) => <span className="font-medium text-fg">{r.name}</span> },
            { key: 'tools', header: 'Tools', sortValue: (r) => r.tools, align: 'right', cell: (r) => r.tools },
            { key: 'runs', header: 'Runs', sortValue: (r) => r.runs, align: 'right', cell: (r) => r.runs },
            {
              key: 'cov',
              header: 'Enforced',
              sortValue: (r) => r.enforcedShare ?? -1,
              cell: (r) =>
                r.enforcedShare === null ? (
                  <span className="text-muted">No runs yet</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-subtle" role="presentation">
                      <span className="block h-full bg-ok-solid" style={{ width: `${r.enforcedShare}%` }} />
                    </span>
                    <span className="tabular text-xs">{r.enforcedShare}%</span>
                  </span>
                ),
            },
            { key: 'blocked', header: 'Blocked', sortValue: (r) => r.blocked, align: 'right', hideOnNarrow: true, cell: (r) => r.blocked },
            { key: 'held', header: 'Held', sortValue: (r) => r.held, align: 'right', hideOnNarrow: true, cell: (r) => r.held },
            { key: 'unp', header: 'Shadow / Off', align: 'right', hideOnNarrow: true, cell: (r) => `${r.shadow} / ${r.off}` },
          ]}
          emptyTitle="No apps registered"
        />
      </Card>

      <Card as="section" aria-label="Recent incidents" className="mt-6">
        <CardHeader title="Recent incidents" actions={<ButtonLink to="/app/incidents" size="sm">View all</ButtonLink>} />
        <IncidentsTable incidents={m.recent} loading={loading} error={error} onRetry={() => void refresh()} pageSize={8} caption="Recent incidents" maxHeight="max-h-none" />
      </Card>
    </>
  );
}
