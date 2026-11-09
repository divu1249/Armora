import type { ToolCall } from './types.ts';

/**
 * Simulated fooled agent for the gateway: a deterministic text-matching "model" that OBEYS whatever
 * instructions appear anywhere in its input (including untrusted documents). It exists to exercise
 * the gate. It says nothing about how a real model behaves.
 *
 * `extractToolCallFromText` is also used to read tool intents out of real Gemini output (regex over
 * free text; crude by design and labelled as such).
 */
export interface AgentProposal {
  text: string;
  toolCalls: ToolCall[];
  source: 'mock' | 'gemini' | 'mock-fallback';
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const UPI_RE = /\b[A-Za-z0-9._-]+@[A-Za-z]{2,}\b(?!\.)/g;

export function extractToolCallFromText(text: string): ToolCall | undefined {
  const t = text ?? '';

  const refund = /(refund|issue_refund)[^.\n]{0,80}?(\d[\d,]*(?:\.\d+)?)/i.exec(t);
  if (refund) {
    const amount = Number(refund[2].replace(/,/g, ''));
    const upis = (t.match(UPI_RE) ?? []).filter((u) => !/\.[a-z]{2,}$/i.test(u));
    if (amount > 0 && upis.length > 0) {
      return { tool: 'issue_refund', args: { amount, upiId: upis[upis.length - 1].toLowerCase(), reason: 'Requested in conversation' } };
    }
  }

  if (/(send_email|e-?mail|forward|send)\b/i.test(t)) {
    const addrs = t.match(EMAIL_RE);
    if (addrs && addrs.length > 0) {
      return {
        tool: 'send_email',
        args: { to: addrs[addrs.length - 1].toLowerCase(), subject: 'Automated agent message', body: t.slice(0, 2000) },
      };
    }
  }

  const status = /\b(CAND_\d{1,6})\b/.exec(t);
  const order = /\b(ORD-\d{1,8})\b/.exec(t);
  if (order && /(status|track|lookup|where|order)/i.test(t)) return { tool: 'lookup_order', args: { orderId: order[1] } };
  if (status && /(read|review|summari[sz]e|evaluate|screen|file)/i.test(t)) return { tool: 'read_candidate_files', args: { candidateId: status[1] } };
  return undefined;
}

/** The simulated agent reads all messages; later (more recent) instructions win. */
export function mockAgentRespond(messages: Array<{ role: string; content: string }>): AgentProposal {
  const all = messages.map((m) => m.content).join('\n');
  // prefer a tool intent found in the most recent messages that contains one
  let call: ToolCall | undefined;
  for (let i = messages.length - 1; i >= 0 && !call; i--) call = extractToolCallFromText(messages[i].content);
  call ??= extractToolCallFromText(all);
  const text = call
    ? `[simulated agent] I will call ${call.tool}.`
    : '[simulated agent] I have no tool action to take. Here is a plain-text answer based on the conversation.';
  return { text, toolCalls: call ? [call] : [], source: 'mock' };
}
