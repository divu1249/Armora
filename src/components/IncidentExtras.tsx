import React from 'react';
import type { Incident, Segment } from '../../server/types.ts';

type Match = NonNullable<Incident['argProvenance']>['matches'][number];

/** Segment text with the argument-provenance matches highlighted (offsets index into the segment content). */
export const ProvenanceHighlight: React.FC<{ segment: Segment; matches: Match[] }> = ({ segment, matches }) => {
  const mine = matches.filter((m) => m.segmentId === segment.id).sort((a, b) => a.start - b.start);
  if (mine.length === 0) return null;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  mine.forEach((m, i) => {
    if (m.start < cursor) return;
    parts.push(<span key={`t${i}`}>{segment.content.slice(cursor, m.start)}</span>);
    parts.push(
      <mark key={`m${i}`} title={`${m.arg} (${m.kind}) matched by ${m.method}`} className="bg-danger-solid/30 text-fg rounded px-0.5 border-b-2 border-danger-solid">
        {segment.content.slice(m.start, m.end)}
      </mark>
    );
    cursor = m.end;
  });
  parts.push(<span key="rest">{segment.content.slice(cursor)}</span>);
  return (
    <div className="mt-2 p-2 bg-code border border-danger-solid/40 rounded">
      <div className="text-3xs font-mono text-danger mb-1">
        Argument provenance: tool argument(s) {Array.from(new Set(mine.map((m) => m.arg))).join(', ')} appear in this {segment.trust} segment
        {mine.every((m) => m.untrusted) ? '' : ' (some matches are in trusted text)'}
      </div>
      <pre className="text-2xs font-mono text-fg whitespace-pre-wrap max-h-36 overflow-y-auto">{parts}</pre>
      {mine.map((m, i) => (
        <div key={i} className="text-3xs font-mono text-muted">
          {m.arg} = {m.value} · [{m.start}-{m.end}] · {m.method}
        </div>
      ))}
    </div>
  );
};

export const ProvenanceNote: React.FC<{ provenance?: Incident['argProvenance'] }> = ({ provenance }) => {
  if (!provenance) return null;
  return (
    <div className="mt-2 text-3xs font-mono text-muted">
      {provenance.argDerivedFromUntrusted ? 'argDerivedFromUntrusted: true. ' : 'argDerivedFromUntrusted: false (no text match; this does NOT prove the value is trustworthy). '}
      {provenance.note}
    </div>
  );
};

/** Before / after of output inspection (markdown images and links to non-allow-listed hosts). */
export const OutputInspectionView: React.FC<{ items?: Incident['outputInspections'] }> = ({ items }) => {
  const changed = (items ?? []).filter((i) => i.inspection.changed);
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      {items.map((it, idx) => (
        <div key={idx} className="p-3 bg-surface rounded border border-line text-xs">
          <div className="text-2xs font-mono text-accent mb-1">
            Output inspection · {it.source.replace('_', ' ')} · {it.inspection.changed ? `${it.inspection.changes.length} rewrite(s)` : 'clean'}
          </div>
          {it.inspection.changed ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <div className="text-3xs text-danger font-mono mb-0.5">BEFORE</div>
                <pre className="text-3xs font-mono text-code-fg whitespace-pre-wrap bg-code p-2 rounded border border-line max-h-40 overflow-y-auto">{it.inspection.before}</pre>
              </div>
              <div>
                <div className="text-3xs text-ok font-mono mb-0.5">AFTER</div>
                <pre className="text-3xs font-mono text-code-fg whitespace-pre-wrap bg-code p-2 rounded border border-line max-h-40 overflow-y-auto">{it.inspection.after}</pre>
              </div>
            </div>
          ) : (
            <pre className="text-3xs font-mono text-muted whitespace-pre-wrap max-h-24 overflow-y-auto">{it.inspection.after}</pre>
          )}
          {it.inspection.changes.map((c, i) => (
            <div key={i} className="text-3xs font-mono text-muted">
              {c.kind} {c.action}: {c.host} ({c.reason})
            </div>
          ))}
        </div>
      ))}
      {changed.length === 0 && <div className="text-3xs text-muted font-mono">No images or links to non-allow-listed hosts were found.</div>}
    </div>
  );
};

export const StepsView: React.FC<{ steps?: Incident['steps'] }> = ({ steps }) => {
  if (!steps || steps.length === 0) return null;
  return (
    <ol className="mt-2 space-y-1 text-2xs font-mono">
      {steps.map((s) => (
        <li key={s.index} className="flex items-center gap-2 text-fg2">
          <span className="text-accent">{s.index + 1}.</span>
          <span>{s.label}</span>
          <span className="text-muted">{s.tool ? `${s.tool}()` : s.kind}</span>
          <span className={s.status === 'blocked' ? 'text-ok' : s.status === 'executed' ? 'text-warn' : 'text-muted'}>{s.status}</span>
          {s.decision && <span className="text-muted">[{s.decision.action}/{s.decision.ruleId}]</span>}
        </li>
      ))}
    </ol>
  );
};

export const MatchedRulesView: React.FC<{ decision: Incident['decision'] }> = ({ decision }) => {
  if (!decision.matchedRules || decision.matchedRules.length === 0) return null;
  return (
    <div className="pt-1 text-2xs text-muted">
      All matched rules (most restrictive wins):{' '}
      {decision.matchedRules.map((m) => (
        <span key={m.ruleId} className={`mr-1.5 px-1 rounded border ${m.action === 'deny' ? 'border-danger-solid/40 text-danger' : 'border-warn-solid/40 text-warn'}`}>
          {m.ruleId}:{m.action}
        </span>
      ))}
    </div>
  );
};
