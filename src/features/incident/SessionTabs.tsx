import React, { useCallback, useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { fetchAuditProof, fetchCredentialLedger, fetchLedgerEvents, fetchReportDrafts } from '../../services/api.ts';
import type { IncidentReportDrafts } from '../../../server/blastRadius.ts';
import { Badge, Tone } from '../../ui/Badge.tsx';
import { Button } from '../../ui/Button.tsx';
import { Card, CardBody, CardHeader } from '../../ui/Card.tsx';
import { DataTable } from '../../ui/DataTable.tsx';
import { Drawer } from '../../ui/Drawer.tsx';
import { KeyValue } from '../../ui/KeyValue.tsx';
import { Skeleton } from '../../ui/Skeleton.tsx';
import { Tabs } from '../../ui/Tabs.tsx';
import { useToast } from '../../ui/Toast.tsx';
import { timeAgo } from '../../lib/format.ts';
import { EmptyState } from '../../ui/EmptyState.tsx';

function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    load().then((d) => live && setData(d)).catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  return { data, error, retry: () => setNonce((n) => n + 1) };
}

const TOKEN_TONE: Record<string, Tone> = { active: 'warn', redeemed: 'ok', expired: 'neutral', revoked: 'info' };

/** Tokens that were issued, redeemed, rejected or revoked in this session. */
export const SessionCredentialsTab: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const { data, error, retry } = useLoad(() => fetchCredentialLedger({ sessionId, pageSize: 50 }), [sessionId]);
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Armora never gives the agent a credential. For each allowed call it creates a one-time token bound to that tool, session and exact arguments, uses it inside the gateway, and records what happened. Token strings are never stored.
      </p>
      <DataTable
        caption="Tokens for this session"
        rows={data?.tokens ?? []}
        loading={!data && !error}
        error={error}
        onRetry={retry}
        getRowId={(t: { jti: string }) => t.jti}
        columns={[
          { key: 'jti', header: 'Token id', cell: (t: any) => <code className="font-mono text-2xs">{t.jti.slice(0, 18)}…</code> },
          { key: 'tool', header: 'Tool', sortValue: (t: any) => t.tool, cell: (t: any) => <code className="font-mono text-2xs">{t.tool}</code> },
          { key: 'approval', header: 'Approval', hideOnNarrow: true, cell: (t: any) => t.approvalId ?? 'not needed' },
          { key: 'status', header: 'Status', sortValue: (t: any) => t.status, cell: (t: any) => <Badge tone={TOKEN_TONE[t.status] ?? 'neutral'}>{t.status}</Badge> },
          { key: 'rej', header: 'Rejected tries', align: 'right', cell: (t: any) => t.rejectedAttempts },
          { key: 'when', header: 'Issued', sortValue: (t: any) => Date.parse(t.issuedAt), cell: (t: any) => timeAgo(t.issuedAt) },
        ]}
        emptyTitle="No tokens were issued"
        emptyDescription="The gate blocked or held every call, so no credential was created. That is the point."
      />
      {data && data.rejections.length > 0 && (
        <Card>
          <CardHeader title="Rejected token presentations" description="Every rejection is logged with its reason." headingLevel={3} />
          <ul className="divide-y divide-line text-sm">
            {data.rejections.map((r: any) => (
              <li key={r.eventId} className="flex flex-wrap items-center gap-2 px-4 py-2">
                <Badge tone="danger">{r.code}</Badge>
                <span className="text-fg2">{r.reason}</span>
                <span className="ml-auto text-2xs text-muted">{timeAgo(r.ts)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
};

/** Every ledger event of the session with the audit entry that commits to it, plus an on-demand proof. */
export const AuditProofTab: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const { data, error, retry } = useLoad(() => fetchLedgerEvents({ sessionId, pageSize: 500 }), [sessionId]);
  const [proof, setProof] = useState<any | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const { toast } = useToast();
  const verify = useCallback(
    async (seq: number) => {
      setBusy(seq);
      try {
        setProof((await fetchAuditProof(seq)).proof);
      } catch (e) {
        toast({ title: 'Could not verify', description: e instanceof Error ? e.message : '', tone: 'danger' });
      } finally {
        setBusy(null);
      }
    },
    [toast]
  );
  const events = [...(data?.items ?? [])].reverse();
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Each event is committed to a keyed hash chain. Hash-chained and keyed; detects edits, deletions and reordering; an attacker with both the key and the files can still forge; external anchoring is the production fix.
      </p>
      <DataTable
        caption="Ledger events and their audit entries"
        rows={events}
        loading={!data && !error}
        error={error}
        onRetry={retry}
        getRowId={(e: { id: string }) => e.id}
        pageSize={12}
        columns={[
          { key: 'ts', header: 'Time', cell: (e: any) => <span className="font-mono text-2xs">{e.ts.slice(11, 23)}</span> },
          { key: 'type', header: 'Event', sortValue: (e: any) => e.type, cell: (e: any) => <code className="font-mono text-2xs">{e.type}</code> },
          { key: 'detail', header: 'Detail', hideOnNarrow: true, cell: (e: any) => <span className="text-xs text-muted">{[e.tool, e.ruleId, e.action].filter(Boolean).join(' · ')}</span> },
          { key: 'seq', header: 'Audit entry', align: 'right', sortValue: (e: any) => e.auditSeq, cell: (e: any) => `#${e.auditSeq}` },
          {
            key: 'verify',
            header: '',
            align: 'right',
            cell: (e: any) => (
              <Button size="sm" loading={busy === e.auditSeq} onClick={() => void verify(e.auditSeq)} aria-label={`Verify audit entry ${e.auditSeq}`}>
                Verify
              </Button>
            ),
          },
        ]}
        emptyTitle="No ledger events"
        emptyDescription="Seeded sample incidents have no ledger events. Run a scenario to see real proofs."
      />
      <Drawer open={Boolean(proof)} onClose={() => setProof(null)} title={proof ? `Proof for audit entry #${proof.entry.seq}` : ''} description="Recomputed on the server with the audit key.">
        {proof && (
          <div className="space-y-4">
            <KeyValue
              items={[
                { label: 'Keyed hash recomputes', value: <Badge tone={proof.entryHashValid ? 'ok' : 'danger'}>{proof.entryHashValid ? 'yes' : 'NO'}</Badge> },
                { label: 'Links to previous entry', value: <Badge tone={proof.linkValid ? 'ok' : 'danger'}>{proof.linkValid ? 'yes' : 'NO'}</Badge> },
                { label: 'Hash path to anchor', value: <Badge tone={proof.pathValid ? 'ok' : 'warn'}>{proof.pathValid ? `${proof.path.length} entries verified` : 'not available yet'}</Badge> },
                { label: 'Anchor', value: proof.anchor ? <Badge tone={proof.anchorSigValid && proof.anchorMatches ? 'ok' : 'danger'}>{`seq ${proof.anchor.seq}, ${proof.anchorSigValid && proof.anchorMatches ? 'signature and head match' : 'MISMATCH'}`}</Badge> : <Badge tone="warn">none covers this entry yet</Badge> },
                { label: 'Entry hash', value: proof.entry.hash, mono: true },
                { label: 'Previous hash', value: proof.entry.prevHash, mono: true },
              ]}
            />
            <p className="text-xs text-muted">{proof.note}</p>
          </div>
        )}
      </Drawer>
    </div>
  );
};

/** CERT-In and DPDP drafts computed from the recorded events. They assert no legal deadline. */
export const ReportTab: React.FC<{ incidentId: string }> = ({ incidentId }) => {
  const { data, error, retry } = useLoad<{ drafts: IncidentReportDrafts }>(() => fetchReportDrafts(incidentId), [incidentId]);
  const { toast } = useToast();
  if (error) return <EmptyState title="Could not build the drafts" description={error} action={<Button onClick={retry}>Try again</Button>} />;
  if (!data) return <Skeleton className="h-64" />;
  const d = data.drafts;
  const copy = (text: string, what: string) => {
    navigator.clipboard.writeText(text).then(() => toast({ title: `${what} copied`, tone: 'ok' })).catch(() => toast({ title: 'Copy failed', tone: 'warn' }));
  };
  return (
    <div className="space-y-6">
      <div role="note" className="rounded-md border border-warn/40 bg-warn/10 p-3 text-sm text-fg2">
        <strong className="text-warn">Draft for legal and security review.</strong> {d.disclaimer}
      </div>
      <p className="text-xs text-muted">{d.computedFrom}</p>
      <Tabs
        label="Report drafts"
        tabs={[
          {
            id: 'certin',
            label: 'Security incident report',
            content: (
              <Card>
                <CardHeader title={d.certInDraft.title} actions={<Button size="sm" leftIcon={<Copy className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => copy(JSON.stringify(d.certInDraft, null, 2), 'Draft')}>Copy</Button>} headingLevel={3} />
                <CardBody className="space-y-4 text-sm">
                  <KeyValue
                    items={[
                      { label: 'Reporting timeline', value: d.certInDraft.reportingTimeline },
                      { label: 'Category', value: d.certInDraft.incidentCategory },
                      { label: 'Affected system', value: d.certInDraft.affectedSystem },
                      { label: 'How it started', value: d.certInDraft.vulnerabilityIdentified },
                    ]}
                  />
                  <div>
                    <p className="mb-1 font-medium text-fg">Chronology (from ledger events)</p>
                    <ol className="list-decimal space-y-0.5 pl-5 font-mono text-2xs text-fg2">{d.certInDraft.chronologyOfEvents.map((c, i) => <li key={i}>{c}</li>)}</ol>
                  </div>
                  <div>
                    <p className="mb-1 font-medium text-fg">Mitigation</p>
                    <ul className="list-disc space-y-0.5 pl-5 text-fg2">{d.certInDraft.mitigationActions.map((c, i) => <li key={i}>{c}</li>)}</ul>
                  </div>
                </CardBody>
              </Card>
            ),
          },
          {
            id: 'dpdp',
            label: 'Personal data notice',
            content: (
              <Card>
                <CardHeader title={d.dpdpDraft.title} actions={<Button size="sm" leftIcon={<Copy className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => copy(JSON.stringify(d.dpdpDraft, null, 2), 'Draft')}>Copy</Button>} headingLevel={3} />
                <CardBody>
                  <KeyValue
                    items={[
                      { label: 'Regulatory reference', value: d.dpdpDraft.regulatoryReference },
                      { label: 'Notice', value: d.dpdpDraft.dataProtectionBoardNotice },
                      { label: 'Affected records', value: d.dpdpDraft.affectedDataPrincipals },
                      { label: 'Data elements found', value: d.dpdpDraft.compromisedDataElements.join(', ') || 'none detected' },
                      { label: 'Containment', value: d.dpdpDraft.actionGateContainmentStatus },
                    ]}
                  />
                </CardBody>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
};
