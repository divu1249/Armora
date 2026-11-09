import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Copy, Download, OctagonAlert, ShieldCheck } from 'lucide-react';
import type { Incident } from '../../../server/types.ts';
import { addBlocklistEntry, downloadEvidenceBundle, fetchIncidentById, toggleKillSwitch } from '../../services/api.ts';
import { useAppData } from '../../app/AppData.tsx';
import { PageHeader } from '../../ui/PageHeader.tsx';
import { Badge, decisionLabel, decisionTone, StatusChip } from '../../ui/Badge.tsx';
import { Button, ButtonLink } from '../../ui/Button.tsx';
import { Card, CardBody, CardHeader } from '../../ui/Card.tsx';
import { KeyValue } from '../../ui/KeyValue.tsx';
import { Tabs } from '../../ui/Tabs.tsx';
import { Dialog } from '../../ui/Dialog.tsx';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { PageSkeleton } from '../../ui/Skeleton.tsx';
import { Term } from '../../ui/Tooltip.tsx';
import { useToast } from '../../ui/Toast.tsx';
import { Timeline, TimelineItem } from '../../ui/Timeline.tsx';
import { ReplayTimeline } from '../../features/incident/ReplayTimeline.tsx';
import { BlastRadiusPanel } from '../../features/incident/BlastRadiusPanel.tsx';
import { EvidenceTab } from '../../features/incident/EvidenceTab.tsx';
import { AuditProofTab, ReportTab, SessionCredentialsTab } from '../../features/incident/SessionTabs.tsx';
import { MatchedRulesView } from '../../components/IncidentExtras.tsx';
import { timeAgo } from '../../lib/format.ts';

const WHY: Record<string, (i: Incident) => React.ReactNode> = {
  deny: (i) => (
    <>
      The agent asked to run <code className="font-mono text-xs">{i.toolCall?.tool ?? 'a tool'}</code>. Rule <strong>{i.decision.ruleId}</strong> says that content the agent did not write cannot authorize this kind of action, so Armora refused and created no credential.
    </>
  ),
  approve: () => <>This call sends something outside or is above a limit, so Armora held it for a person. It expires after 60 seconds if nobody decides.</>,
  allow: (i) => (i.firewallMode === 'enforce' ? <>No rule objected, so Armora created a one-time token for exactly this call and let it run.</> : <>Protection was in {i.firewallMode} mode, so the call was allowed to run. Open the Evidence tab to see what the gate would have done.</>),
};

const StepList: React.FC<{ incident: Incident }> = ({ incident }) => {
  const steps = incident.steps ?? [];
  if (steps.length === 0) return <p className="text-sm text-muted">This run has no recorded step sequence.</p>;
  const items: TimelineItem[] = steps.map((s) => ({
    id: String(s.index),
    title: `${s.index + 1}. ${s.label}`,
    description: [s.tool ? `${s.tool}()` : s.kind, s.decision ? `gate: ${s.decision.action} (${s.decision.ruleId})` : null].filter(Boolean).join(' · '),
    tone: s.status === 'blocked' ? 'ok' : s.status === 'executed' ? 'warn' : s.status === 'pending_approval' ? 'warn' : 'neutral',
    meta: <Badge tone={s.status === 'blocked' ? 'ok' : s.status === 'executed' ? 'warn' : 'neutral'}>{s.status.replace('_', ' ')}</Badge>,
  }));
  return <Timeline items={items} label="Scenario steps" />;
};

export default function IncidentDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { incidents, quarantinedAgents, refresh, markIncidentReviewed, loading } = useAppData();
  const { toast } = useToast();
  const cached = useMemo(() => incidents.find((i) => i.id === id), [incidents, id]);
  const [incident, setIncident] = useState<Incident | null>(cached ?? null);
  const [missing, setMissing] = useState(false);
  const [quarantineOpen, setQuarantineOpen] = useState(false);

  useEffect(() => {
    let live = true;
    markIncidentReviewed();
    setMissing(false);
    fetchIncidentById(id)
      .then((i) => live && setIncident(i))
      .catch(() => live && !cached && setMissing(true));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const agentId = incident ? `agent_${incident.scenarioId}` : '';
  const quarantined = quarantinedAgents.includes(agentId);

  const blocklist = useCallback(async () => {
    if (!incident?.toolCall) return;
    const a = incident.toolCall.args as Record<string, unknown>;
    const to = typeof a.to === 'string' ? a.to : Array.isArray(a.to) ? String(a.to[0]) : undefined;
    const indicator = typeof a.upiId === 'string' ? a.upiId.split('@')[1] : to?.split('@')[1];
    if (!indicator) return toast({ title: 'No recipient or payee to block in this run', tone: 'warn' });
    try {
      await addBlocklistEntry({ indicator, type: typeof a.upiId === 'string' ? 'upi_handle' : 'domain', scope: 'organization', mode: 'block', ttlHours: 720 });
      toast({ title: `Added ${indicator} to the blocklist`, description: 'It is pending approval on the Intelligence page.', tone: 'ok' });
    } catch (e) {
      toast({ title: 'Could not add to blocklist', description: e instanceof Error ? e.message : 'Admin token may be required', tone: 'danger' });
    }
  }, [incident, toast]);

  const setQuarantine = async (on: boolean) => {
    try {
      await toggleKillSwitch(agentId, on, on ? 'Quarantined from the incident page' : 'Quarantine lifted');
      toast({ title: on ? 'Agent quarantined' : 'Quarantine lifted', description: on ? 'Outstanding tokens were revoked and each revocation is logged.' : undefined, tone: on ? 'warn' : 'ok' });
      await refresh();
    } catch (e) {
      toast({ title: 'Kill switch failed', description: e instanceof Error ? e.message : 'Admin token may be required', tone: 'danger' });
    } finally {
      setQuarantineOpen(false);
    }
  };

  if (!incident && (loading || !missing)) return <PageSkeleton />;
  if (!incident)
    return (
      <>
        <PageHeader title="Incident not found" breadcrumbs={[{ label: 'Incidents', to: '/app/incidents' }, { label: id }]} />
        <Card>
          <EmptyState title="We could not find this incident" description="It may have been removed by a demo reset. Incidents are kept across restarts, but a reset archives them." action={<ButtonLink to="/app/incidents" variant="primary">Back to incidents</ButtonLink>} />
        </Card>
      </>
    );

  const why = WHY[incident.decision.action]?.(incident);
  return (
    <>
      <PageHeader
        title={incident.scenarioTitle}
        breadcrumbs={[{ label: 'Incidents', to: '/app/incidents' }, { label: incident.id }]}
        description={`${incident.appName ?? 'App'} · ${timeAgo(incident.timestamp)} · protection mode ${incident.firewallMode}`}
        badges={
          <>
            <Badge tone={decisionTone(incident.decision.action)} dot>
              {decisionLabel(incident.decision.action)}
            </Badge>
            {incident.isSeeded && <StatusChip kind="SEEDED" />}
            {incident.llmMode === 'mock' && <StatusChip kind="SIMULATED" />}
            {incident.dataLeftPremises && <Badge tone="danger">Data left the premises</Badge>}
          </>
        }
        actions={
          <>
            <Button leftIcon={<Download className="h-4 w-4" aria-hidden="true" />} onClick={() => downloadEvidenceBundle(incident.id).catch((e: Error) => toast({ title: 'Download failed', description: e.message, tone: 'danger' }))}>
              Evidence bundle
            </Button>
            <Button variant={quarantined ? 'secondary' : 'danger'} leftIcon={<OctagonAlert className="h-4 w-4" aria-hidden="true" />} onClick={() => (quarantined ? void setQuarantine(false) : setQuarantineOpen(true))}>
              {quarantined ? 'Lift quarantine' : 'Quarantine agent'}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {why && (
            <Card tone={incident.decision.action === 'deny' ? 'ok' : 'default'}>
              <CardBody className="flex items-start gap-3 text-sm text-fg2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                <div>
                  <p className="font-medium text-fg">Why this decision</p>
                  <p className="mt-0.5">{why}</p>
                </div>
              </CardBody>
            </Card>
          )}
          <Tabs
            label="Incident sections"
            tabs={[
              {
                id: 'timeline',
                label: 'Timeline',
                content: (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader title="Steps of this run" description="Every tool call passed the gate with the state built from earlier results." headingLevel={3} />
                      <CardBody>
                        <StepList incident={incident} />
                      </CardBody>
                    </Card>
                    <ReplayTimeline incidentId={incident.id} />
                  </div>
                ),
              },
              { id: 'evidence', label: 'Evidence', content: <EvidenceTab incident={incident} /> },
              { id: 'blast', label: 'Blast radius', content: <BlastRadiusPanel incidentId={incident.id} /> },
              { id: 'credentials', label: 'Credentials', content: <SessionCredentialsTab sessionId={incident.id} /> },
              { id: 'audit', label: 'Audit proof', content: <AuditProofTab sessionId={incident.id} /> },
              { id: 'report', label: 'Report', content: <ReportTab incidentId={incident.id} /> },
            ]}
          />
        </div>

        <aside aria-label="Incident summary" className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader title="Summary" headingLevel={2} />
            <CardBody>
              <KeyValue
                items={[
                  { label: 'Decision', value: <Badge tone={decisionTone(incident.decision.action)}>{decisionLabel(incident.decision.action)}</Badge> },
                  { label: 'Primary rule', value: incident.decision.ruleId, mono: true },
                  { label: <Term term="Untrusted content">Risk</Term>, value: incident.riskLevel },
                  { label: 'Tool call', value: incident.toolCall ? `${incident.toolCall.tool}()` : 'none', mono: true },
                  { label: 'Agent', value: incident.llmMode === 'gemini' ? 'Gemini' : 'Simulated agent' },
                  { label: 'Mode', value: incident.firewallMode },
                  { label: 'Latency', value: `${incident.latency.totalMs} ms total` },
                  { label: 'Session', value: incident.id, mono: true },
                ]}
              />
              <div className="mt-3">
                <MatchedRulesView decision={incident.decision} />
              </div>
              {incident.llmFallbackReason && <p className="mt-3 rounded-md border border-warn/30 bg-warn/10 p-2 text-xs text-fg2">Gemini was requested but unavailable, so this run used the simulated agent.</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Actions" headingLevel={2} />
            <CardBody className="flex flex-col gap-2">
              <Button leftIcon={<Copy className="h-4 w-4" aria-hidden="true" />} onClick={() => navigator.clipboard.writeText(JSON.stringify(incident, null, 2)).then(() => toast({ title: 'Incident JSON copied', tone: 'ok' }))}>
                Copy incident JSON
              </Button>
              <Button onClick={() => void blocklist()} disabled={!incident.toolCall}>Add destination to blocklist</Button>
              <ButtonLink to="/app/audit">Open audit log</ButtonLink>
            </CardBody>
          </Card>
        </aside>
      </div>

      <Dialog
        open={quarantineOpen}
        onClose={() => setQuarantineOpen(false)}
        title="Quarantine this agent?"
        description={`${agentId} will be blocked from all tools and its outstanding tokens revoked. You can lift this later.`}
        footer={
          <>
            <Button onClick={() => setQuarantineOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => void setQuarantine(true)}>Quarantine</Button>
          </>
        }
      >
        <p className="text-sm text-fg2">This is the kill switch. Every revoked token is written to the credential ledger with the reason.</p>
      </Dialog>
    </>
  );
}
