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
      <mark key={`m${i}`} title={`${m.arg} (${m.kind}) matched by ${m.method}`} className="bg-[#ff365d]/30 text-white rounded px-0.5 border-b-2 border-[#ff365d]">
        {segment.content.slice(m.start, m.end)}
      </mark>
    );
    cursor = m.end;
  });
  parts.push(<span key="rest">{segment.content.slice(cursor)}</span>);
  return (
    <div className="mt-2 p-2 bg-[#050810] border border-[#ff365d]/30 rounded">
      <div className="text-3xs font-mono text-[#ff365d] mb-1">
        Argument provenance: tool argument(s) {Array.from(new Set(mine.map((m) => m.arg))).join(', ')} appear in this {segment.trust} segment
        {mine.every((m) => m.untrusted) ? '' : ' (some matches are in trusted text)'}
      </div>
      <pre className="text-2xs font-mono text-slate-200 whitespace-pre-wrap max-h-36 overflow-y-auto">{parts}</pre>
      {mine.map((m, i) => (
        <div key={i} className="text-3xs font-mono text-slate-500">
          {m.arg} = {m.value} · [{m.start}-{m.end}] · {m.method}
        </div>
      ))}
    </div>
  );
};

export const ProvenanceNote: React.FC<{ provenance?: Incident['argProvenance'] }> = ({ provenance }) => {
  if (!provenance) return null;
  return (
    <div className="mt-2 text-3xs font-mono text-[#8293aa]">
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
        <div key={idx} className="p-3 bg-[#090d18] rounded border border-[#00e5ff]/15 text-xs">
          <div className="text-2xs font-mono text-[#00e5ff] mb-1">
            Output inspection · {it.source.replace('_', ' ')} · {it.inspection.changed ? `${it.inspection.changes.length} rewrite(s)` : 'clean'}
          </div>
          {it.inspection.changed ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <div className="text-3xs text-[#ff365d] font-mono mb-0.5">BEFORE</div>
                <pre className="text-3xs font-mono text-slate-300 whitespace-pre-wrap bg-[#050810] p-2 rounded border border-[#ff365d]/20 max-h-40 overflow-y-auto">{it.inspection.before}</pre>
              </div>
              <div>
                <div className="text-3xs text-[#00f5a0] font-mono mb-0.5">AFTER</div>
                <pre className="text-3xs font-mono text-slate-300 whitespace-pre-wrap bg-[#050810] p-2 rounded border border-[#00f5a0]/20 max-h-40 overflow-y-auto">{it.inspection.after}</pre>
              </div>
            </div>
          ) : (
            <pre className="text-3xs font-mono text-slate-400 whitespace-pre-wrap max-h-24 overflow-y-auto">{it.inspection.after}</pre>
          )}
          {it.inspection.changes.map((c, i) => (
            <div key={i} className="text-3xs font-mono text-slate-500">
              {c.kind} {c.action}: {c.host} ({c.reason})
            </div>
          ))}
        </div>
      ))}
      {changed.length === 0 && <div className="text-3xs text-slate-500 font-mono">No images or links to non-allow-listed hosts were found.</div>}
    </div>
  );
};

export const StepsView: React.FC<{ steps?: Incident['steps'] }> = ({ steps }) => {
  if (!steps || steps.length === 0) return null;
  return (
    <ol className="mt-2 space-y-1 text-2xs font-mono">
      {steps.map((s) => (
        <li key={s.index} className="flex items-center gap-2 text-slate-300">
          <span className="text-[#00e5ff]">{s.index + 1}.</span>
          <span>{s.label}</span>
          <span className="text-slate-500">{s.tool ? `${s.tool}()` : s.kind}</span>
          <span className={s.status === 'blocked' ? 'text-[#00f5a0]' : s.status === 'executed' ? 'text-[#ffb020]' : 'text-slate-400'}>{s.status}</span>
          {s.decision && <span className="text-slate-500">[{s.decision.action}/{s.decision.ruleId}]</span>}
        </li>
      ))}
    </ol>
  );
};

export const MatchedRulesView: React.FC<{ decision: Incident['decision'] }> = ({ decision }) => {
  if (!decision.matchedRules || decision.matchedRules.length === 0) return null;
  return (
    <div className="pt-1 text-2xs text-slate-400">
      All matched rules (most restrictive wins):{' '}
      {decision.matchedRules.map((m) => (
        <span key={m.ruleId} className={`mr-1.5 px-1 rounded border ${m.action === 'deny' ? 'border-[#ff365d]/50 text-[#ff365d]' : 'border-[#ffb020]/50 text-[#ffb020]'}`}>
          {m.ruleId}:{m.action}
        </span>
      ))}
    </div>
  );
};
