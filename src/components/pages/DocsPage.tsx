import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '../../brand.ts';
import { GATEWAY_EXAMPLES, toCurl } from '../../../shared/gatewayExamples.ts';
import { GLOSSARY } from '../../lib/glossary.ts';
import { CodeBlock } from '../../ui/CodeBlock.tsx';
import { Card, CardBody } from '../../ui/Card.tsx';
import { Badge, StatusChip } from '../../ui/Badge.tsx';

const HEADERS: Array<[string, string]> = [
  ['x-armora-decision', 'allow, approve or deny: the most restrictive decision among the returned tool calls.'],
  ['x-armora-session', 'The session id. Send it back as x-armora-session to continue the session, and use it in /v1/tools/execute.'],
  ['x-armora-agent-source', 'mock, gemini or mock-fallback. mock-fallback means Gemini was requested but unavailable, so the SIMULATED agent answered.'],
  ['x-armora-output', 'rewritten if images or links to unknown hosts were removed from the reply or from an email body.'],
  ['x-armora-trust (request)', 'Trust labels by message index, for example 1=RETRIEVED_DOC,2=TOOL_OUTPUT. Callers can only lower trust.'],
  ['x-armora-mode (request)', 'shadow or enforce (default enforce).'],
];

const TOC = [
  ['overview', 'Overview'],
  ['quickstart', 'Quick start'],
  ['headers', 'Headers'],
  ['auth', 'Authentication'],
  ['limits', 'Limits'],
  ['concepts', 'Concepts'],
];

/** Gateway docs: the curl examples below are the same ones the regression tests execute. */
export const DocsPage: React.FC = () => {
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  useEffect(() => {
    document.title = `Docs · ${BRAND.name}`;
  }, []);
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:px-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="On this page" className="hidden lg:block">
        <ul className="sticky top-20 space-y-1 text-sm">
          {TOC.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="block rounded-md px-2 py-1 text-muted hover:bg-subtle hover:text-fg">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 space-y-12">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-fg">Gateway docs</h1>
          <p className="mt-2 text-muted">Try {BRAND.name} from a terminal. Every example below is executed by the automated tests against the real handlers.</p>
        </header>

        <section id="overview" className="space-y-3">
          <h2 className="text-xl font-semibold text-fg">Overview</h2>
          <p className="text-sm text-fg2">
            <code className="font-mono text-xs">POST /v1/chat/completions</code> is an OpenAI-compatible subset (non-streaming). It labels trust, runs the detectors, forwards to the simulated agent or Gemini, inspects the output, and returns the reply with decision headers. Tool calls come back annotated with the gate decision. <strong>Nothing is executed by this call.</strong>
          </p>
          <p className="text-sm text-fg2">
            <code className="font-mono text-xs">POST /v1/tools/execute</code> is the <strong>only</strong> path that executes protected tools. It runs the policy, queues an approval if needed, creates a one-time Ed25519 token inside the gateway, calls the tool server and records everything. The response never contains a token or an upstream secret.
          </p>
          <p className="text-sm text-fg2">
            <code className="font-mono text-xs">GET /v1/approvals/{'{id}'}</code> returns the status and result of a call held for a person.
          </p>
        </section>

        <section id="quickstart" className="space-y-4">
          <h2 className="text-xl font-semibold text-fg">Quick start</h2>
          <p className="text-sm text-muted">Run these in order. Example 2 returns the session id used by examples 4 and 5: <code className="font-mono text-xs">SESSION=$(… | grep -i x-armora-session …)</code>.</p>
          {GATEWAY_EXAMPLES.map((ex) => (
            <Card key={ex.id} as="article">
              <CardBody className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-fg">{ex.title}</h3>
                  {ex.id === 'stream_roadmap' && <StatusChip kind="ROADMAP" />}
                  <Badge className="ml-auto">
                    expect HTTP {ex.expect.status}
                    {ex.expect.decisionHeader ? `, ${ex.expect.decisionHeader}` : ''}
                  </Badge>
                </div>
                <p className="text-xs text-muted">{ex.description}</p>
                <CodeBlock code={toCurl(ex, base)} language="bash" label={`curl · ${ex.id}`} maxHeight="max-h-72" />
              </CardBody>
            </Card>
          ))}
        </section>

        <section id="headers" className="space-y-3">
          <h2 className="text-xl font-semibold text-fg">Headers</h2>
          <dl className="divide-y divide-line rounded-lg border border-line bg-surface">
            {HEADERS.map(([k, v]) => (
              <div key={k} className="grid gap-1 p-3 md:grid-cols-[14rem_1fr] md:gap-4">
                <dt><code className="font-mono text-xs text-fg">{k}</code></dt>
                <dd className="text-sm text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="auth" className="space-y-3">
          <h2 className="text-xl font-semibold text-fg">Authentication</h2>
          <p className="text-sm text-fg2">If <code className="font-mono text-xs">ARMORA_GATEWAY_KEY</code> is configured, send <code className="font-mono text-xs">Authorization: Bearer $KEY</code>. It is optional locally and required in production (without it the gateway answers 503). Approving a held call is a person&apos;s action through <code className="font-mono text-xs">POST /api/approvals/{'{id}'}</code>, which needs the admin token in production.</p>
          <p className="text-sm text-muted">Planned: short-lived workload tokens instead of a shared key. <StatusChip kind="ROADMAP" /></p>
        </section>

        <section id="limits" className="space-y-3">
          <h2 className="text-xl font-semibold text-fg">Limits</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-fg2">
            <li>Streaming is not implemented. <code className="font-mono text-xs">stream: true</code> returns 501, so no client silently receives uninspected output. <StatusChip kind="ROADMAP" /></li>
            <li>Only text content is supported.</li>
            <li>The built-in agent is a simulation that obeys injected text. A <code className="font-mono text-xs">gemini*</code> model is used only if it passed the startup check.</li>
            <li>Trust labels come from your app. {BRAND.name} cannot know which text is hostile.</li>
          </ul>
        </section>

        <section id="concepts" className="space-y-3">
          <h2 className="text-xl font-semibold text-fg">Concepts</h2>
          <dl className="divide-y divide-line rounded-lg border border-line bg-surface">
            {Object.entries(GLOSSARY).map(([term, def]) => (
              <div key={term} className="grid gap-1 p-3 md:grid-cols-[12rem_1fr] md:gap-4">
                <dt className="text-sm font-medium text-fg">{term}</dt>
                <dd className="text-sm text-muted">{def}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted">
            Want the honest inventory? See <Link className="font-medium text-accent hover:underline" to="/app/real-vs-simulated">Real vs simulated</Link>.
          </p>
        </section>
      </div>
    </div>
  );
};

export default DocsPage;
