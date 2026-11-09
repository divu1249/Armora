import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Ban, ChevronDown, FileSearch, KeyRound, Play, ShieldCheck } from 'lucide-react';
import { BRAND } from '../../brand.ts';
import { ButtonLink } from '../../ui/Button.tsx';
import { Card, CardBody } from '../../ui/Card.tsx';
import { Badge, StatusChip } from '../../ui/Badge.tsx';
import { ContainDiagram, PreventDiagram, ProveDiagram } from './diagrams.tsx';
import { PricingSection } from './PricingPage.tsx';
import { FAQ } from '../../lib/pricing.ts';
import { fetchPolicy, fetchRedTeamAttacks, fetchScenarios } from '../../services/api.ts';
import { parsePolicyForView } from '../../lib/policyEdit.ts';

const PILLARS = [
  {
    id: 'prevent',
    title: 'Prevent',
    icon: Ban,
    Diagram: PreventDiagram,
    text: 'Every tool call an agent proposes is checked before it runs. Text the agent read cannot authorize a sensitive action on its own: the gate looks at the call, the session state (did it read private data? did it take in untrusted text?) and where the recipient or payee came from.',
    points: ['Allow, ask a person, or block', 'Recipient lists, cc/bcc and lookalike domains are checked address by address', 'Images and links to unknown hosts are stripped from output'],
  },
  {
    id: 'contain',
    title: 'Contain',
    icon: FileSearch,
    Diagram: ContainDiagram,
    text: 'No standing keys. When a call is allowed, Armora creates a one-time credential for exactly that call, uses it inside the gateway, and records it. If something goes wrong you can see what a run touched, what left, and what was stopped, and revoke everything an agent holds with one click.',
    points: ['One-time tokens bound to the exact arguments', 'Blast radius built from recorded events, not a template', 'Kill switch revokes outstanding tokens'],
  },
  {
    id: 'prove',
    title: 'Prove',
    icon: BadgeCheck,
    Diagram: ProveDiagram,
    text: 'Every decision, token and tool call is written to a keyed hash chain on disk. Edits, deletions and reordering are detectable, each entry has a proof you can verify, and one click exports an evidence bundle for review.',
    points: ['Per-entry proofs and signed local anchors', 'Evidence bundle you can check offline', 'Report drafts built from recorded data'],
  },
];

const STEPS = [
  ['Label and clean', 'Each message gets a trust label. Text is normalized so hidden characters and encoded payloads cannot hide.'],
  ['Detect', 'Heuristic detectors raise signals: injection phrases, sensitive data, leaked canaries. They inform the gate; they do not decide.'],
  ['Gate', 'Rules look at the tool call, the session state and argument provenance. The most restrictive matching rule wins.'],
  ['Credential', 'If allowed, or after a person approves, a one-time token is created for that exact call and used by the gateway, never by the agent.'],
  ['Record', 'Everything lands in the event ledger and the keyed audit chain, ready for the blast radius view and the evidence bundle.'],
];

const LIMITS = [
  'Armora does not make a model resistant to prompt injection. It limits what a fooled model can do.',
  'The detectors are heuristics. They miss things and raise false alarms. The red-team page reports both on a small hand-written set, not on the real world.',
  'Argument provenance is a signal, not a guarantee: a model that paraphrases a value defeats text matching.',
  'It protects only the calls that go through the gateway.',
  'In this prototype the broker, the vault and the tool server run in one process. A real deployment would separate them.',
  'Someone holding both the audit key and the log files can forge entries. External anchoring is the production fix and is not built.',
  'The demo agent is a simulation that obeys injected text. Gemini is used only when it passes a startup check, and runs say which agent produced them.',
  'Streaming responses, single sign-on and role-based access are not built.',
  'Compliance pages and report drafts are aids for review. They are not certifications and not legal advice.',
];

const MODEL = [
  ['The agent is untrusted', 'It never holds a tool credential or an upstream secret.'],
  ['The gate is deterministic', 'Plain rules over the call and the session state. No model decides.'],
  ['The broker signs, the tool server verifies', 'Ed25519: the tool server holds only the public key, so it cannot mint tokens.'],
  ['Tokens are narrow', 'One use, short life, bound to tool, session and exact arguments. Replay, tampering and cross-session use are rejected and logged.'],
  ['The log is keyed', 'Hash-chained and keyed; detects edits, deletions and reordering. Local anchors are a witness simulation.'],
];

/** Numbers here are COUNTED from this server's own data when the page loads. Nothing is hard-coded. */
const LiveFacts: React.FC = () => {
  const [facts, setFacts] = useState<{ scenarios: number; attacks: number; benign: number; rules: number } | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([fetchScenarios(), fetchRedTeamAttacks(), fetchPolicy()])
      .then(([sc, atk, pol]) => {
        if (!live) return;
        const attacks = (atk as { attacks: Array<{ isHarmful: boolean }> }).attacks ?? [];
        setFacts({ scenarios: sc.length, attacks: attacks.length, benign: attacks.filter((a) => !a.isHarmful).length, rules: parsePolicyForView(pol.policyYaml).rules.length });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  if (!facts) return null;
  return (
    <section aria-label="Counted from this demo server" className="mx-auto mt-10 max-w-3xl">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        {[
          ['Scenarios', facts.scenarios],
          ['Rules in the active policy', facts.rules],
          ['Seed attack and benign tasks', facts.attacks],
          ['…of which benign', facts.benign],
        ].map(([k, v]) => (
          <div key={String(k)} className="bg-surface p-4 text-center">
            <dd className="tabular text-2xl font-semibold text-fg">{v}</dd>
            <dt className="mt-0.5 text-2xs text-muted">{k}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-center text-2xs text-muted">Counted from this server&apos;s own data when the page loaded. They describe the demo, not the real world.</p>
    </section>
  );
};

export default function LandingPage() {
  useEffect(() => {
    document.title = `${BRAND.name} · ${BRAND.tagline}`;
  }, []);
  return (
    <>
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 text-center md:px-6 md:pt-24">
          <Badge tone="accent" className="mb-6">
            {BRAND.tagline}
          </Badge>
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-fg md:text-5xl">{BRAND.thesis}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
            {BRAND.name} sits between your AI agents and their tools. It checks every action, gives out one-time credentials instead of standing keys, and keeps a log you can verify.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink to="/app/overview" variant="primary" size="lg">
              Open live demo
            </ButtonLink>
            <ButtonLink to="/app/overview?tour=1" size="lg" leftIcon={<Play className="h-4 w-4" aria-hidden="true" />}>
              Watch the 3-minute walkthrough
            </ButtonLink>
          </div>
          <p className="mt-4 text-xs text-muted">The demo runs on synthetic data with a simulated agent. No sign-up.</p>
          <LiveFacts />
        </div>
      </section>

      <section aria-labelledby="pillars" className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <h2 id="pillars" className="text-center text-2xl font-semibold tracking-tight text-fg">Prevent, contain, prove</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PILLARS.map((p) => (
            <Card as="article" key={p.id} className="flex flex-col">
              <CardBody className="flex flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <p.icon className="h-5 w-5 text-accent" aria-hidden="true" />
                  <h3 className="text-lg font-semibold text-fg">{p.title}</h3>
                </div>
                <div className="my-4 rounded-md border border-line bg-canvas p-2">
                  <p.Diagram />
                </div>
                <p className="text-sm text-fg2">{p.text}</p>
                <ul className="mt-3 space-y-1 text-sm text-muted">
                  {p.points.map((x) => (
                    <li key={x} className="flex gap-2">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden="true" />
                      {x}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="how" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <h2 id="how" className="text-center text-2xl font-semibold tracking-tight text-fg">How it works</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-5">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="relative rounded-lg border border-line bg-canvas p-4">
                <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-solid text-xs font-semibold text-on-solid">{i + 1}</span>
                <h3 className="mt-3 text-sm font-semibold text-fg">{t}</h3>
                <p className="mt-1 text-xs text-muted">{d}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-center text-sm text-muted">
            Try it from a terminal: the <Link to="/docs" className="font-medium text-accent hover:underline">gateway docs</Link> have curl examples for <code className="font-mono text-xs">/v1/chat/completions</code> and <code className="font-mono text-xs">/v1/tools/execute</code>.
          </p>
        </div>
      </section>

      <section aria-labelledby="limits" className="mx-auto max-w-4xl px-4 py-16 md:px-6">
        <h2 id="limits" className="text-center text-2xl font-semibold tracking-tight text-fg">What {BRAND.name} does not do</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted">We would rather you know the limits before you rely on it.</p>
        <ul className="mt-8 space-y-3">
          {LIMITS.map((l) => (
            <li key={l} className="flex gap-3 rounded-lg border border-line bg-surface p-4 text-sm text-fg2">
              <Ban className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
              {l}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-sm text-muted">
          The <Link className="font-medium text-accent hover:underline" to="/app/real-vs-simulated">Real vs simulated</Link> page lists every component with a chip:{' '}
          <span className="inline-flex flex-wrap items-center gap-1 align-middle"><StatusChip kind="BUILT" /><StatusChip kind="PROTOTYPE" /><StatusChip kind="SEEDED" /><StatusChip kind="PRECOMPUTED" /><StatusChip kind="ROADMAP" /></span>
        </p>
      </section>

      <section aria-labelledby="security" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-16 md:px-6">
          <h2 id="security" className="text-center text-2xl font-semibold tracking-tight text-fg">Security model</h2>
          <dl className="mt-8 divide-y divide-line rounded-lg border border-line bg-canvas">
            {MODEL.map(([k, v]) => (
              <div key={k} className="grid gap-1 p-4 md:grid-cols-[16rem_1fr] md:gap-4">
                <dt className="flex items-center gap-2 text-sm font-medium text-fg"><KeyRound className="h-4 w-4 text-accent" aria-hidden="true" />{k}</dt>
                <dd className="text-sm text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <PricingSection />

      <section aria-labelledby="faq" className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        <h2 id="faq" className="text-center text-2xl font-semibold tracking-tight text-fg">Questions</h2>
        <div className="mt-8 divide-y divide-line rounded-lg border border-line bg-surface">
          {FAQ.map((f) => (
            <details key={f.q} className="group p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-fg">
                {f.q}
                <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-2 text-sm text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
