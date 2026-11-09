import React, { useState } from 'react';
import { PageHeader } from '../../ui/PageHeader.tsx';
import { Card, CardBody, CardHeader } from '../../ui/Card.tsx';
import { Tabs } from '../../ui/Tabs.tsx';
import { KeyValue } from '../../ui/KeyValue.tsx';
import { Badge, StatusChip } from '../../ui/Badge.tsx';
import { Button, ButtonLink } from '../../ui/Button.tsx';
import { DataTable, useDensity } from '../../ui/DataTable.tsx';
import { Segmented } from '../../ui/fields.tsx';
import { Dialog } from '../../ui/Dialog.tsx';
import { BRAND } from '../../brand.ts';
import { PLANS, PRICING_NOTE } from '../../lib/pricing.ts';
import { useAppData } from '../../app/AppData.tsx';
import { useTheme } from '../../app/Theme.tsx';

const TEAM = [
  { name: 'Demo user', email: 'demo@example.com', role: 'Admin', last: 'now' },
  { name: 'Priya S.', email: 'priya@example.com', role: 'Security analyst', last: '2h ago' },
  { name: 'Rohan V.', email: 'rohan@example.com', role: 'Auditor (read-only)', last: 'yesterday' },
];

export default function SettingsPage() {
  const { config, resetDemo } = useAppData();
  const { theme, setTheme } = useTheme();
  const [density, setDensity] = useDensity();
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <>
      <PageHeader title="Settings" description="Organization, team, gateway authentication, billing and appearance." />
      <Tabs
        label="Settings sections"
        tabs={[
          {
            id: 'org',
            label: 'Organization',
            content: (
              <Card>
                <CardHeader title="Organization" description="This prototype has one demo organization." />
                <CardBody>
                  <KeyValue
                    items={[
                      { label: 'Name', value: BRAND.organization },
                      { label: 'Environment', value: 'Demo (synthetic data)' },
                      { label: 'Server mode', value: config ? (config.production ? 'production' : 'development') : 'unknown' },
                      { label: 'Demo-only features', value: config ? (config.demoMode ? 'enabled (tamper demo, tool-call override)' : 'disabled') : 'unknown' },
                    ]}
                  />
                </CardBody>
              </Card>
            ),
          },
          {
            id: 'team',
            label: 'Team',
            content: (
              <div className="space-y-3">
                <p className="rounded-md border border-warn/30 bg-warn/10 p-3 text-sm text-fg2">
                  <StatusChip kind="SEEDED" /> These people are made up. Roles are labels only: this prototype does not enforce role-based access. Write actions use a single admin token.
                </p>
                <DataTable caption="Team members (mock)" rows={TEAM} getRowId={(r) => r.email} pageSize={10} columns={[
                  { key: 'name', header: 'Name', sortValue: (r) => r.name, cell: (r) => <span className="font-medium text-fg">{r.name}</span> },
                  { key: 'email', header: 'Email', hideOnNarrow: true, cell: (r) => r.email },
                  { key: 'role', header: 'Role', sortValue: (r) => r.role, cell: (r) => <Badge>{r.role}</Badge> },
                  { key: 'last', header: 'Last active', cell: (r) => r.last },
                ]} />
              </div>
            ),
          },
          {
            id: 'gateway',
            label: 'Gateway authentication',
            content: (
              <div className="space-y-4">
                <Card>
                  <CardHeader title="How apps should authenticate" description="Short-lived workload tokens, not static keys." actions={<StatusChip kind="ROADMAP" />} />
                  <CardBody className="space-y-2 text-sm text-fg2">
                    <p>The intended model: each app or agent runtime gets a workload identity from your platform (for example a cloud or Kubernetes identity). It exchanges that for a gateway token that lasts minutes, scoped to one app. Nothing long-lived is stored in the app, so there is no key to leak from a repository or a prompt.</p>
                    <p>This is not built yet. Treat it as the design target.</p>
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="What the prototype does today" actions={<StatusChip kind="PROTOTYPE" />} />
                  <CardBody>
                    <KeyValue
                      items={[
                        { label: 'Gateway (/v1/*)', value: 'One shared bearer key set by the operator in the server environment. It is required in production and is never shown in this app.' },
                        { label: 'Write actions (/api/*)', value: config?.adminTokenRequired ? 'Require the admin token (enter it from the user menu).' : 'Open in development; require the admin token in production.' },
                        { label: 'Tool credentials', value: 'Agents receive none. One-time tokens are created and used inside the gateway.' },
                      ]}
                    />
                    <div className="mt-3">
                      <ButtonLink to="/app/credentials" size="sm">See the credential ledger</ButtonLink>
                    </div>
                  </CardBody>
                </Card>
              </div>
            ),
          },
          {
            id: 'billing',
            label: 'Billing',
            content: (
              <div className="space-y-3">
                <p className="rounded-md border border-warn/30 bg-warn/10 p-3 text-sm text-fg2">{PRICING_NOTE}</p>
                <div className="grid gap-4 md:grid-cols-3">
                  {PLANS.map((p) => (
                    <Card key={p.id} tone={p.id === 'developer' ? 'ok' : 'default'}>
                      <CardBody>
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-fg">{p.name}</h3>
                          {p.id === 'developer' && <Badge tone="ok">Current plan</Badge>}
                        </div>
                        <p className="mt-2 text-2xl font-semibold text-fg">{p.price}</p>
                        <p className="text-xs text-muted">{p.unit}</p>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            ),
          },
          {
            id: 'appearance',
            label: 'Appearance',
            content: (
              <Card>
                <CardBody className="space-y-5">
                  <div>
                    <p className="mb-1 text-sm font-medium text-fg">Theme</p>
                    <Segmented label="Theme" value={theme} onChange={setTheme} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} />
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-medium text-fg">Table density</p>
                    <Segmented label="Table density" value={density} onChange={setDensity} options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]} />
                  </div>
                </CardBody>
              </Card>
            ),
          },
          {
            id: 'data',
            label: 'Demo data',
            content: (
              <Card>
                <CardHeader title="Reset demo data" description="Archives the current logs, incidents and ledger (nothing is deleted) and starts a new audit chain." />
                <CardBody>
                  <Button variant="danger" onClick={() => setConfirmReset(true)}>Reset demo data…</Button>
                </CardBody>
              </Card>
            ),
          },
        ]}
      />
      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset demo data?"
        description="Old files are archived next to the new ones. Pending approvals and in-memory sessions are cleared."
        footer={
          <>
            <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => { setConfirmReset(false); void resetDemo(); }}>Reset</Button>
          </>
        }
      >
        <p className="text-sm text-fg2">This also resets the audit chain to a new genesis entry.</p>
      </Dialog>
    </>
  );
}
