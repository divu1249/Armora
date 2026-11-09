import React, { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { fetchTimeline } from '../../services/api.ts';
import type { ReplayTimelineStep } from '../../../server/blastRadius.ts';
import { Button } from '../../ui/Button.tsx';
import { Card, CardBody, CardHeader } from '../../ui/Card.tsx';
import { Select } from '../../ui/fields.tsx';
import { Timeline, TimelineItem } from '../../ui/Timeline.tsx';
import { Tone } from '../../ui/Badge.tsx';
import { Skeleton } from '../../ui/Skeleton.tsx';
import { EmptyState } from '../../ui/EmptyState.tsx';

const TONE: Record<ReplayTimelineStep['status'], Tone> = { SUCCESS: 'ok', BLOCKED: 'danger', FLAGGED: 'warn', PENDING: 'warn' };

/** Replay of the recorded events. Gaps between steps are the real timestamp gaps (sped up, clamped). */
export const ReplayTimeline: React.FC<{ incidentId: string }> = ({ incidentId }) => {
  const [steps, setSteps] = useState<ReplayTimelineStep[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);

  useEffect(() => {
    let live = true;
    setSteps(null);
    fetchTimeline(incidentId)
      .then((d: { timeline: ReplayTimelineStep[] }) => {
        if (!live) return;
        setSteps(d.timeline);
        setShown(d.timeline.length);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [incidentId]);

  useEffect(() => {
    if (!playing || !steps) return;
    if (shown >= steps.length) {
      setPlaying(false);
      return;
    }
    const gap = (steps[shown]?.timeOffsetMs ?? 0) - (steps[shown - 1]?.timeOffsetMs ?? 0);
    const t = setTimeout(() => setShown((s) => Math.min(steps.length, s + 1)), Math.min(2000, Math.max(250, gap / speed)));
    return () => clearTimeout(t);
  }, [playing, shown, steps, speed]);

  if (error) return <Card tone="danger"><CardBody className="text-sm">Could not load the timeline: {error}</CardBody></Card>;
  if (!steps) return <Skeleton className="h-64" />;
  if (steps.length === 0) return <Card><EmptyState title="No recorded events" description="Seeded sample incidents have no ledger events. Run a scenario to see a real replay." /></Card>;

  const items: TimelineItem[] = steps.slice(0, shown || 0).map((s) => ({
    id: s.eventId,
    title: s.title,
    description: `${s.phase}: ${s.description}`,
    time: `T+${s.timeOffsetMs} ms`,
    tone: TONE[s.status],
  }));
  return (
    <Card as="section" aria-label="Event replay">
      <CardHeader
        title="Event replay"
        description="Steps appear at the pace they were recorded."
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => { setShown(0); setPlaying(false); }} leftIcon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}>
              Reset
            </Button>
            <Button size="sm" variant="primary" onClick={() => { if (shown >= steps.length) setShown(0); setPlaying(!playing); }} leftIcon={playing ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}>
              {playing ? 'Pause' : 'Play'}
            </Button>
            <Button size="sm" disabled={shown >= steps.length} onClick={() => setShown((s) => Math.min(steps.length, s + 1))} leftIcon={<SkipForward className="h-3.5 w-3.5" aria-hidden="true" />}>
              Step
            </Button>
            <Select aria-label="Replay speed" value={speed} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSpeed(Number(e.target.value))} className="h-8 w-20 text-xs">
              <option value={1}>1x</option>
              <option value={4}>4x</option>
              <option value={16}>16x</option>
            </Select>
          </>
        }
      />
      <CardBody>
        <p className="mb-3 text-xs text-muted" aria-live="polite">
          Showing {shown} of {steps.length} recorded events
        </p>
        {items.length === 0 ? <p className="text-sm text-muted">Press Play or Step to begin.</p> : <Timeline items={items} activeId={items[items.length - 1]?.id} label="Recorded events" />}
      </CardBody>
    </Card>
  );
};
