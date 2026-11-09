/** Illustrative pricing. Not a real billing system; every place that shows it says so. */
export interface Plan {
  id: 'developer' | 'team' | 'enterprise';
  name: string;
  price: string;
  unit: string;
  blurb: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

export const PRICING_NOTE = 'Illustrative pricing for this prototype. Nothing can be purchased and no payment is collected.';

export const PLANS: Plan[] = [
  {
    id: 'developer',
    name: 'Free Developer',
    price: '$0',
    unit: 'forever',
    blurb: 'Try the gateway locally and read every line of the code.',
    features: ['Run the open-source prototype yourself', 'Action gate and policy editor', 'One-time token broker and credential ledger', 'Local keyed audit log with anchors', 'Community support'],
    cta: 'Open the live demo',
  },
  {
    id: 'team',
    name: 'Team',
    price: '$149',
    unit: 'per protected app, per month',
    blurb: 'For teams that put agents in front of real tools.',
    features: ['Everything in Free Developer', 'Approval queue with notifications', 'Evidence bundles and report drafts', 'Shared policies and versions', 'Email support'],
    cta: 'Talk to us',
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    unit: 'annual agreement',
    blurb: 'For regulated environments with their own infrastructure.',
    features: ['Broker and tool servers deployed separately', 'External log anchoring (roadmap)', 'Single sign-on and role-based access (roadmap)', 'Security review support', 'Named support contact'],
    cta: 'Contact sales',
  },
];

export const FAQ: Array<{ q: string; a: string }> = [
  { q: 'Is this a finished, hosted product?', a: 'No. Armora is a working prototype. The demo runs on synthetic data, the default agent is a simulation, and several components are labelled BUILT, PROTOTYPE, SEEDED, PRECOMPUTED or ROADMAP so you always know which is which.' },
  { q: 'Does Armora stop prompt injection?', a: 'No tool can promise that. Detectors are heuristics and can be bypassed. Armora puts the enforcement on the tool call instead: untrusted content cannot, by itself, authorize a sensitive action, and credentials exist only for calls the gate allowed or a person approved.' },
  { q: 'Which models does it work with?', a: 'The gateway speaks an OpenAI-compatible subset (non-streaming). The built-in agent is a simulation. Gemini is used only if it passes a startup check; otherwise runs are labelled as simulated.' },
  { q: 'Where does my data go?', a: 'The prototype keeps its state on the machine it runs on: logs and incidents as local files, other state in memory. It makes no calls to third-party services except Gemini when you configure it.' },
  { q: 'Can an attacker with access to the server forge the audit log?', a: 'Yes, if they have both the key and the files. The log detects edits, deletions and reordering without the key. External anchoring is the production fix and is on the roadmap.' },
  { q: 'What does the pricing mean?', a: 'It is illustrative. It shows how a product like this could be packaged. Nothing here can be bought.' },
];
