import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useAppData } from '../../app/AppData.tsx';
import { PageHeader } from '../../ui/PageHeader.tsx';
import { Input, Select } from '../../ui/fields.tsx';
import { Button } from '../../ui/Button.tsx';
import { IncidentsTable } from './IncidentsTable.tsx';

export default function IncidentsPage() {
  const { incidents, apps, loading, error, refresh, setRunnerOpen } = useAppData();
  const [q, setQ] = useState('');
  const [decision, setDecision] = useState('');
  const [app, setApp] = useState('');
  const [mode, setMode] = useState('');
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return incidents.filter(
      (i) =>
        (!decision || i.decision.action === decision) &&
        (!app || i.appId === app) &&
        (!mode || i.firewallMode === mode) &&
        (!needle || `${i.scenarioTitle} ${i.id} ${i.decision.ruleId} ${i.appName ?? ''}`.toLowerCase().includes(needle))
    );
  }, [incidents, q, decision, app, mode]);
  return (
    <>
      <PageHeader title="Incidents" description="Every agent run, with its decision, evidence and blast radius." actions={<Button variant="primary" onClick={() => setRunnerOpen(true)}>Run scenario</Button>} />
      <IncidentsTable
        incidents={rows}
        loading={loading}
        error={error}
        onRetry={() => void refresh()}
        pageSize={15}
        caption="All incidents"
        maxHeight="max-h-none"
        toolbar={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted" aria-hidden="true" />
              <Input aria-label="Search incidents" placeholder="Search runs, rules, ids" value={q} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)} className="w-56 pl-8" />
            </div>
            <Select aria-label="Filter by decision" value={decision} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDecision(e.target.value)} className="w-40">
              <option value="">Any decision</option>
              <option value="deny">Blocked</option>
              <option value="approve">Needs approval</option>
              <option value="allow">Allowed</option>
            </Select>
            <Select aria-label="Filter by app" value={app} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setApp(e.target.value)} className="w-44">
              <option value="">All apps</option>
              {apps.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <Select aria-label="Filter by protection mode" value={mode} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMode(e.target.value)} className="w-36">
              <option value="">Any mode</option>
              <option value="enforce">Enforce</option>
              <option value="shadow">Shadow</option>
              <option value="off">Off</option>
            </Select>
          </>
        }
      />
    </>
  );
}
