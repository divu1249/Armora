import React, { useState } from 'react';
import { BookOpen, Copy } from 'lucide-react';
import { GATEWAY_EXAMPLES, toCurl } from '../../../shared/gatewayExamples.ts';

/** Gateway docs: working curl examples (the same examples are executed by the regression tests). */
export const DocsPage: React.FC = () => {
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-sm font-bold font-heading text-white uppercase tracking-wide flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#00e5ff]" />
          Gateway API · try it with curl
          <span className="text-3xs font-mono text-[#00f5a0] bg-[#00f5a0]/10 border border-[#00f5a0]/30 px-2 py-0.5 rounded">[BUILT]</span>
          <span className="text-3xs font-mono text-[#a855f7] bg-[#a855f7]/10 border border-[#a855f7]/30 px-2 py-0.5 rounded">[ROADMAP] streaming</span>
        </h2>
        <p className="text-xs text-[#8293aa] mt-1 leading-relaxed">
          <code>POST /v1/chat/completions</code> is an OpenAI-compatible subset (non-streaming): it normalizes, labels trust, runs the detectors, forwards to the simulated agent or Gemini, inspects the output and
          returns the reply with <code>x-armora-decision</code> and <code>x-armora-session</code> headers; tool calls come back annotated with the gate decision.
          <code> POST /v1/tools/execute</code> is the <strong>only</strong> path that executes protected tools: it runs the policy, queues approval if needed, mints a one-time Ed25519 token internally, calls the tool server and records everything.
          The agent never receives a token or any upstream secret.
        </p>
        <ul className="text-xs text-[#8293aa] mt-2 list-disc pl-5 space-y-0.5">
          <li><strong>Streaming is ROADMAP:</strong> <code>stream: true</code> returns 501 so no client silently receives un-inspected output.</li>
          <li>Trust labels: <code>x-armora-trust: 1=RETRIEVED_DOC,2=TOOL_OUTPUT</code> (message index) or <code>metadata.armora_trust</code>. Callers can only lower trust. Labels come from your app; Armora cannot know which text is hostile.</li>
          <li>If <code>ARMORA_GATEWAY_KEY</code> is configured add <code>-H 'Authorization: Bearer $KEY'</code> (mandatory in production).</li>
          <li>The default agent is a <strong>simulated fooled agent</strong> (it obeys injected text). A Gemini model name uses Gemini only if it passed the boot-time probe; otherwise the response says it is simulated.</li>
          <li>Run the examples in order; example 2 returns the session id used by 4 and 5 (<code>SESSION=$(… | grep -i x-armora-session …)</code>).</li>
        </ul>
      </div>
      {GATEWAY_EXAMPLES.map((ex) => {
        const text = toCurl(ex, base);
        return (
          <div key={ex.id} className="bg-[#0b1329] border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-white">{ex.title}</div>
              <button
                type="button"
                className="text-3xs text-slate-300 flex items-center gap-1 border border-slate-700 rounded px-2 py-0.5"
                onClick={() => {
                  navigator.clipboard.writeText(text);
                  setCopied(ex.id);
                  setTimeout(() => setCopied(null), 1500);
                }}
              >
                <Copy className="w-3 h-3" /> {copied === ex.id ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-3xs text-[#8293aa] my-1.5 leading-relaxed">{ex.description}</p>
            <pre className="text-3xs text-slate-200 bg-black/40 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">{text}</pre>
            <div className="text-3xs text-slate-500 mt-1">
              Expect HTTP {ex.expect.status}
              {ex.expect.decisionHeader ? `, x-armora-decision: ${ex.expect.decisionHeader}` : ''}.
            </div>
          </div>
        );
      })}
    </div>
  );
};
