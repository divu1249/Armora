import React from 'react';
import type { Finding, Incident, Segment } from '../../../server/types.ts';
import { Badge, StatusChip, Tone } from '../../ui/Badge.tsx';
import { Card, CardBody, CardHeader } from '../../ui/Card.tsx';
import { DataTable } from '../../ui/DataTable.tsx';
import { Term } from '../../ui/Tooltip.tsx';
import { OutputInspectionView, ProvenanceHighlight, ProvenanceNote } from '../../components/IncidentExtras.tsx';
import { CodeBlock } from '../../ui/CodeBlock.tsx';

const TRUST_TONE: Record<string, Tone> = { SYSTEM: 'accent', USER: 'accent', TOOL_OUTPUT: 'danger', RETRIEVED_DOC: 'danger', UNKNOWN: 'warn' };
const TRUST_HELP: Record<string, string> = {
  SYSTEM: 'Written by the app owner.',
  USER: 'Typed by the signed-in user.',
  TOOL_OUTPUT: 'Returned by a tool. Treated as untrusted.',
  RETRIEVED_DOC: 'A document the agent retrieved. Treated as untrusted.',
  UNKNOWN: 'No label was given, so it is treated as untrusted.',
};

/** Segment text with suspicious spans marked (offsets come from the detectors). */
const Highlighted: React.FC<{ segment: Segment; findings: Finding[] }> = ({ segment, findings }) => {
  const mine = findings.filter((f) => f.segmentId === segment.id && f.end > f.start).sort((a, b) => a.start - b.start);
  if (mine.length === 0) return <>{segment.content}</>;
  const parts: React.ReactNode[] = [];
  let cur = 0;
  mine.forEach((f, i) => {
    const s = Math.max(cur, Math.min(f.start, segment.content.length));
    const e = Math.max(s, Math.min(f.end, segment.content.length));
    if (s > cur) parts.push(<span key={`t${i}`}>{segment.content.slice(cur, s)}</span>);
    parts.push(
      <mark key={`m${i}`} title={`${f.category}: ${f.reason}`} className="rounded-sm border-b-2 border-danger bg-danger/20 px-0.5 text-fg">
        {segment.content.slice(s, e)}
      </mark>
    );
    cur = e;
  });
  parts.push(<span key="end">{segment.content.slice(cur)}</span>);
  return <>{parts}</>;
};

export const EvidenceTab: React.FC<{ incident: Incident }> = ({ incident }) => (
  <div className="space-y-6">
    <Card as="section" aria-label="Inbound content">
      <CardHeader title="What the agent read" description="Each piece of content has a trust label. Marked text was flagged by a detector; outlined text matches a value the agent used." />
      <CardBody className="space-y-4">
        {incident.segments.map((seg) => (
          <div key={seg.id} className="rounded-md border border-line">
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-subtle px-3 py-2 text-xs">
              <span className="font-mono text-fg2">{seg.id}</span>
              <span className="text-muted">role: {seg.role}</span>
              <Badge tone={TRUST_TONE[seg.trust] ?? 'neutral'}>
                {seg.trust}
              </Badge>
              <span className="text-muted">{TRUST_HELP[seg.trust]}</span>
              <span className="ml-auto text-muted">label source: {seg.labelSource}</span>
            </div>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed text-fg2">
              <Highlighted segment={seg} findings={incident.findings} />
            </pre>
            {incident.argProvenance && <div className="px-3 pb-3"><ProvenanceHighlight segment={seg} matches={incident.argProvenance.matches} /></div>}
          </div>
        ))}
        <ProvenanceNote provenance={incident.argProvenance} />
      </CardBody>
    </Card>

    <Card as="section" aria-label="Detector findings">
      <CardHeader title="Detector findings" description={<>Detectors are heuristics: they can miss things and raise false alarms. The <Term term="Action gate" /> decides, not the detectors.</>} />
      <DataTable
        className="rounded-none border-0"
        caption="Detector findings"
        rows={incident.findings}
        getRowId={(f) => f.id}
        pageSize={6}
        columns={[
          { key: 'cat', header: 'Category', sortValue: (f) => f.category, cell: (f) => <code className="font-mono text-2xs">{f.category}</code> },
          { key: 'sev', header: 'Severity', sortValue: (f) => f.severity, cell: (f) => <Badge tone={f.severity === 'CRITICAL' || f.severity === 'HIGH' ? 'danger' : f.severity === 'MEDIUM' ? 'warn' : 'neutral'}>{f.severity}</Badge> },
          { key: 'conf', header: 'Confidence', sortValue: (f) => f.confidence, align: 'right', cell: (f) => `${Math.round(f.confidence * 100)}%` },
          { key: 'why', header: 'Why', hideOnNarrow: true, cell: (f) => <span className="text-xs">{f.reason}</span> },
          { key: 'hash', header: 'Evidence hash', hideOnNarrow: true, cell: (f) => <code className="font-mono text-2xs text-muted" title={f.evidenceHash}>{f.evidenceHash.slice(0, 12)}…</code> },
        ]}
        emptyTitle="No findings"
        emptyDescription="The detectors flagged nothing in this run. That does not prove the content is safe."
      />
    </Card>

    {incident.outputInspections && incident.outputInspections.length > 0 && (
      <Card as="section" aria-label="Output inspection">
        <CardHeader title="Output inspection" description="Images and links to hosts that are not allow-listed are removed or rewritten before anything leaves." />
        <CardBody>
          <OutputInspectionView items={incident.outputInspections} />
        </CardBody>
      </Card>
    )}

    {incident.honestyNote && (
      <Card tone="warn">
        <CardBody className="flex items-start gap-3 text-sm text-fg2">
          <StatusChip kind="PROTOTYPE" />
          <span>{incident.honestyNote}</span>
        </CardBody>
      </Card>
    )}

    <Card as="section" aria-label="Without Armora" tone="danger">
      <CardHeader title="Without Armora: what would have happened" description={<>Contrast only. This is the <em>Simulation of the legacy pattern</em>: a standing key with no limits.</>} actions={<StatusChip kind="SIMULATED" />} />
      <CardBody className="space-y-3 text-sm">
        {incident.withoutFirewallOutcome ? (
          <>
            <CodeBlock language="tool call the attacker asked for" code={`${incident.withoutFirewallOutcome.tool}(${JSON.stringify(incident.withoutFirewallOutcome.args, null, 2)})`} maxHeight="max-h-40" />
            <p className="text-fg2">
              <strong className="text-danger">Impact: </strong>
              {incident.withoutFirewallOutcome.impact}
            </p>
            {incident.withoutFirewallOutcome.financialLoss && <p className="text-warn">Potential loss: {incident.withoutFirewallOutcome.financialLoss}</p>}
          </>
        ) : (
          <p className="text-muted">No counterfactual is defined for this scenario.</p>
        )}
      </CardBody>
    </Card>
  </div>
);
