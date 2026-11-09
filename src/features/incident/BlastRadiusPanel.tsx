import React, { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { downloadEvidenceBundle, fetchBlastRadiusGraph } from '../../services/api.ts';
import type { BlastRadiusGraph, BlastRadiusNode } from '../../../server/blastRadius.ts';
import { Card, CardBody, CardHeader } from '../../ui/Card.tsx';
import { Button } from '../../ui/Button.tsx';
import { Badge, Tone } from '../../ui/Badge.tsx';
import { KeyValue } from '../../ui/KeyValue.tsx';
import { Skeleton } from '../../ui/Skeleton.tsx';
import { useToast } from '../../ui/Toast.tsx';

const COLUMN: Record<string, number> = { untrusted_source: 0, session: 1, tool_call: 2, data_object: 3, token: 3, outbound_destination: 4 };
const TITLES = ['Untrusted sources', 'Session', 'Tool calls', 'Data touched / tokens', 'Destinations'];
const NODE_CLASS: Record<string, string> = {
  allowed: 'fill-danger/10 stroke-danger',
  blocked: 'fill-ok/10 stroke-ok',
  pending: 'fill-warn/10 stroke-warn',
  revoked: 'fill-info/10 stroke-info',
  expired: 'fill-subtle stroke-faint',
  rejected: 'fill-ok/10 stroke-ok',
  info: 'fill-subtle stroke-line-strong',
};
const EDGE_CLASS: Record<string, string> = { allowed: 'stroke-danger', blocked: 'stroke-ok', pending: 'stroke-warn', revoked: 'stroke-info' };
const STATUS_TEXT: Record<string, string> = {
  allowed: 'something really happened',
  blocked: 'blocked',
  pending: 'held for approval',
  revoked: 'revoked',
  expired: 'expired unused',
  rejected: 'rejected',
  info: 'context',
};
const tone = (s: string): Tone => (s === 'allowed' ? 'danger' : s === 'blocked' || s === 'rejected' ? 'ok' : s === 'pending' ? 'warn' : s === 'revoked' ? 'info' : 'neutral');

/** Blast radius computed from the real event ledger (nodes exist only if an event created them). */
export const BlastRadiusPanel: React.FC<{ incidentId: string }> = ({ incidentId }) => {
  const [graph, setGraph] = useState<BlastRadiusGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BlastRadiusNode | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let live = true;
    setGraph(null);
    fetchBlastRadiusGraph(incidentId)
      .then((d: { graph: BlastRadiusGraph }) => live && setGraph(d.graph))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [incidentId]);

  const layout = useMemo(() => {
    const cols: BlastRadiusNode[][] = [[], [], [], [], []];
    for (const n of graph?.nodes ?? []) cols[COLUMN[n.type] ?? 3].push(n);
    const pos = new Map<string, { x: number; y: number }>();
    cols.forEach((c, ci) => c.forEach((n, i) => pos.set(n.id, { x: 12 + ci * 196, y: 28 + i * 52 })));
    return { pos, height: 44 + Math.max(1, ...cols.map((c) => c.length)) * 52 };
  }, [graph]);

  if (error) return <Card tone="danger"><CardBody className="text-sm text-fg">Could not load the blast radius: {error}</CardBody></Card>;
  if (!graph) return <Skeleton className="h-64" />;
  const left = graph.summary.leftPremises;
  const prevented = graph.summary.prevented;

  return (
    <div className="space-y-6">
      <Card as="section" aria-label="Blast radius graph">
        <CardHeader
          title="What this run touched"
          description="Built from the recorded events of this session. Red = it really happened, green = blocked, amber = held for approval, purple = revoked token."
          actions={
            <Button size="sm" leftIcon={<Download className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => downloadEvidenceBundle(incidentId).catch((e: Error) => toast({ title: 'Download failed', description: e.message, tone: 'danger' }))}>
              Evidence bundle (JSON)
            </Button>
          }
        />
        <CardBody>
          {graph.note && <p className="mb-3 rounded-md border border-warn/30 bg-warn/10 p-3 text-xs text-fg2">{graph.note}</p>}
          {graph.nodes.length > 1 && (
            <div className="overflow-x-auto rounded-md border border-line bg-canvas p-2">
              <svg role="img" aria-label={`Blast radius graph with ${graph.nodes.length} nodes and ${graph.edges.length} edges. A list version follows.`} className="min-w-[980px]" viewBox={`0 0 980 ${layout.height}`} height={layout.height}>
                {TITLES.map((t, i) => (
                  <text key={t} x={12 + i * 196} y={14} className="fill-muted" fontSize="10" fontWeight="600">
                    {t}
                  </text>
                ))}
                {graph.edges.map((e) => {
                  const a = layout.pos.get(e.source);
                  const b = layout.pos.get(e.target);
                  if (!a || !b) return null;
                  return (
                    <g key={e.id}>
                      <line x1={a.x + 160} y1={a.y + 18} x2={b.x} y2={b.y + 18} className={EDGE_CLASS[e.status] ?? 'stroke-faint'} strokeWidth="1.5" strokeDasharray={e.status === 'blocked' ? '4 3' : undefined} />
                      <text x={(a.x + 160 + b.x) / 2} y={(a.y + b.y) / 2 + 12} textAnchor="middle" fontSize="8" className="fill-muted">
                        {e.label}
                      </text>
                    </g>
                  );
                })}
                {graph.nodes.map((n) => {
                  const p = layout.pos.get(n.id)!;
                  return (
                    <g key={n.id} transform={`translate(${p.x}, ${p.y})`} onClick={() => setSelected(n)} className="cursor-pointer">
                      <rect width="160" height="36" rx="6" className={NODE_CLASS[n.status] ?? NODE_CLASS.info} strokeWidth="1.5" />
                      <text x="80" y="15" textAnchor="middle" fontSize="10" fontWeight="600" className="fill-fg">
                        {String(n.label).slice(0, 26)}
                      </text>
                      <text x="80" y="28" textAnchor="middle" fontSize="8.5" className="fill-muted">
                        {n.type.replace(/_/g, ' ')} · {n.status}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
          <ul className="mt-4 divide-y divide-line rounded-md border border-line text-sm" aria-label="Blast radius as a list">
            {graph.nodes.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => setSelected(n)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-subtle">
                  <Badge tone={tone(n.status)}>{STATUS_TEXT[n.status] ?? n.status}</Badge>
                  <span className="min-w-0 flex-1 truncate text-fg">{n.label}</span>
                  <span className="text-2xs text-muted">{n.type.replace(/_/g, ' ')}</span>
                </button>
              </li>
            ))}
          </ul>
          {selected && (
            <div className="mt-3 rounded-md border border-line bg-code p-3">
              <p className="mb-1 font-mono text-2xs text-code-muted">{selected.id}</p>
              <pre className="max-h-48 overflow-auto font-mono text-2xs text-code-fg">{JSON.stringify(selected.metadata ?? {}, null, 2)}</pre>
            </div>
          )}
          <p className="mt-3 text-2xs text-muted">
            Built from {graph.generatedFrom.events} ledger events; matched {graph.generatedFrom.outboxRecordsMatched} outbox and {graph.generatedFrom.refundRecordsMatched} refund record(s).
          </p>
        </CardBody>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card as="section" aria-label="What left the premises" tone={left.items.length ? 'danger' : 'ok'}>
          <CardHeader title="What left the premises" description="From the outbox and refund records." />
          <CardBody>
            {left.items.length === 0 ? (
              <p className="text-sm text-fg2">Nothing. No email or payment was sent in this session.</p>
            ) : (
              <>
                <KeyValue
                  items={[
                    { label: 'Recipients', value: left.recipients.join(', ') || 'none' },
                    { label: 'Payees', value: left.payees.join(', ') || 'none' },
                    { label: 'Bytes sent', value: left.totalBytes },
                    { label: 'Refunds total', value: `INR ${left.totalRefundAmount}` },
                    { label: 'Data classes found', value: Object.entries(left.dataClasses).map(([k, v]) => `${k} ×${v}`).join(', ') || 'none detected' },
                    { label: 'Records read / in bodies', value: `${left.recordsTouchedInSession} / ${left.recordsReferenced}` },
                  ]}
                />
                {left.items.some((i) => i.simulation) && <p className="mt-2 text-2xs text-warn">{left.items.find((i) => i.simulation)?.simulation}: this send used the standing key of the legacy-pattern simulation.</p>}
              </>
            )}
          </CardBody>
        </Card>
        <Card as="section" aria-label="What was prevented" tone={prevented.count ? 'ok' : 'default'}>
          <CardHeader title="What was prevented" description="Denied calls, and calls still waiting for a human." />
          <CardBody>
            {prevented.count === 0 ? (
              <p className="text-sm text-fg2">No call was denied or held in this session.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {prevented.items.map((p) => (
                  <li key={p.callId} className="rounded-md border border-line p-3">
                    <div className="flex items-center gap-2">
                      <Badge tone={p.status === 'pending' ? 'warn' : 'ok'}>{p.status === 'pending' ? 'Held' : 'Blocked'}</Badge>
                      <code className="font-mono text-xs text-fg">{p.tool}()</code>
                      {p.ruleId && <code className="font-mono text-2xs text-muted">{p.ruleId}</code>}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      Target: {(p.recipients ?? []).join(', ') || p.upiId || 'n/a'}
                      {p.amount ? ` · INR ${p.amount}` : ''}
                      {Object.keys(p.wouldHaveSentClasses).length ? ` · would have sent: ${Object.entries(p.wouldHaveSentClasses).map(([k, v]) => `${k} ×${v}`).join(', ')}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
