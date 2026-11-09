import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import type { Incident } from '../../../server/types.ts';
import { Badge, decisionLabel, decisionTone, StatusChip } from '../../ui/Badge.tsx';
import { Column, DataTable } from '../../ui/DataTable.tsx';
import { timeAgo } from '../../lib/format.ts';
import { ButtonLink } from '../../ui/Button.tsx';

export const incidentColumns = (): Array<Column<Incident>> => [
  { key: 'time', header: 'When', sortValue: (i) => Date.parse(i.timestamp), cell: (i) => <span title={i.timestamp}>{timeAgo(i.timestamp)}</span> },
  {
    key: 'scenario',
    header: 'Run',
    sortValue: (i) => i.scenarioTitle,
    cell: (i) => (
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-fg">{i.scenarioTitle}</span>
        <span className="truncate text-2xs text-muted">
          {i.appName ?? 'App'} · {i.id}
        </span>
      </span>
    ),
  },
  {
    key: 'decision',
    header: 'Decision',
    sortValue: (i) => i.decision.action,
    cell: (i) => (
      <span className="flex items-center gap-1.5">
        <Badge tone={decisionTone(i.decision.action)} dot>
          {decisionLabel(i.decision.action)}
        </Badge>
        {i.isSeeded && <StatusChip kind="SEEDED" />}
      </span>
    ),
  },
  { key: 'rule', header: 'Rule', sortValue: (i) => i.decision.ruleId, hideOnNarrow: true, cell: (i) => <code className="font-mono text-2xs">{i.decision.ruleId}</code> },
  { key: 'mode', header: 'Mode', sortValue: (i) => i.firewallMode, hideOnNarrow: true, cell: (i) => <span className="capitalize">{i.firewallMode}</span> },
  {
    key: 'left',
    header: 'Data left',
    sortValue: (i) => i.dataLeftPremises,
    cell: (i) => (i.dataLeftPremises ? <Badge tone="danger">Yes</Badge> : <span className="inline-flex items-center gap-1 text-muted"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />No</span>),
  },
];

export const IncidentsTable: React.FC<{
  incidents: readonly Incident[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  pageSize?: number;
  toolbar?: React.ReactNode;
  caption?: string;
  maxHeight?: string;
}> = ({ incidents, loading, error, onRetry, pageSize = 10, toolbar, caption = 'Incidents', maxHeight }) => {
  const navigate = useNavigate();
  return (
    <DataTable
      caption={caption}
      columns={incidentColumns()}
      rows={incidents}
      getRowId={(i) => i.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      pageSize={pageSize}
      toolbar={toolbar}
      maxHeight={maxHeight}
      initialSort={{ key: 'time', dir: 'desc' }}
      onRowActivate={(i) => navigate(`/app/incidents/${i.id}`)}
      emptyTitle="No runs yet"
      emptyDescription="Run a scenario to see how Armora decides, or send a request through the gateway."
      emptyAction={
        <ButtonLink to="/app/compare" variant="primary">
          Run a scenario
        </ButtonLink>
      }
    />
  );
};
