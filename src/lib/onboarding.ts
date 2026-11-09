export interface ChecklistInput {
  /** a gateway session exists (someone called /v1/*) */
  gatewayConnected: boolean;
  /** at least one non-seeded run exists */
  scenarioRun: boolean;
  /** the user opened an incident detail page */
  incidentReviewed: boolean;
}

export interface ChecklistStep {
  id: 'connect' | 'run' | 'review';
  title: string;
  description: string;
  done: boolean;
  to: string;
  cta: string;
}

export function buildChecklist(input: ChecklistInput): { steps: ChecklistStep[]; done: number; complete: boolean } {
  const steps: ChecklistStep[] = [
    { id: 'connect', title: 'Connect an app', description: 'Send one request through POST /v1/chat/completions. Marked done automatically when the gateway sees a session.', done: input.gatewayConnected, to: '/docs', cta: 'See the curl examples' },
    { id: 'run', title: 'Run a scenario', description: 'Replay a prompt-injection attack against a protected app.', done: input.scenarioRun, to: '/app/compare', cta: 'Run one' },
    { id: 'review', title: 'Review an incident', description: 'Open a run and read the decision, the evidence and the blast radius.', done: input.incidentReviewed, to: '/app/incidents', cta: 'Open incidents' },
  ];
  const done = steps.filter((s) => s.done).length;
  return { steps, done, complete: done === steps.length };
}
