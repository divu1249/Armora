import crypto from 'node:crypto';
import { z } from 'zod';
import type { ExecutionOutcome, ExecutionService } from './executionService.ts';
import type { EventLedger } from './ledger.ts';
import type { FirewallMode, GateDecision, Segment, ToolCall, ToolResult, TrustLevel } from './types.ts';
import { extractToolCallFromText, mockAgentRespond } from './mockAgent.ts';
import { inspectOutput, OutputInspection } from './outputInspection.ts';
import { sha256Hex } from './canonical.ts';

/**
 * The product surface (pure handlers, no express):
 *  - POST /v1/chat/completions  OpenAI-compatible subset, NON-streaming (streaming is ROADMAP)
 *  - POST /v1/tools/execute     the ONLY path that executes protected tools
 *  - GET  /v1/approvals/:id     status/result of a held call
 * The agent never receives a token or an upstream secret: tokens are minted and redeemed inside
 * ExecutionService.
 */

export interface GatewayRequest {
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}
export interface GatewayResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface GatewayDeps {
  service: ExecutionService;
  ledger: EventLedger;
  demoMode: boolean;
  allowedHosts: () => string[];
  /** returns true when a real Gemini model can be called */
  geminiAvailable?: () => boolean;
  /** calls Gemini with the conversation text; throws on failure */
  callGemini?: (model: string, conversation: string) => Promise<string>;
}

const TRUST_VALUES = ['SYSTEM', 'USER', 'TOOL_OUTPUT', 'RETRIEVED_DOC', 'UNKNOWN'] as const;
const TrustEnum = z.enum(TRUST_VALUES);
const ID_RE = /^[A-Za-z0-9_.:-]{1,100}$/;

const ContentPart = z.object({ type: z.string(), text: z.string().optional() }).passthrough();
const ChatMessage = z
  .object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.union([z.string(), z.array(ContentPart), z.null()]).optional(),
    name: z.string().max(100).optional(),
  })
  .passthrough();

export const ChatBody = z
  .object({
    model: z.string().min(1).max(100).optional(),
    messages: z.array(ChatMessage).min(1).max(100),
    stream: z.boolean().optional(),
    metadata: z.object({ armora_trust: z.union([z.record(TrustEnum), z.array(TrustEnum.nullable())]).optional() }).passthrough().optional(),
  })
  .passthrough();

export const ExecBody = z
  .object({
    sessionId: z.string().regex(ID_RE).optional(),
    tool: z.string().min(1).max(100),
    args: z.record(z.unknown()),
  })
  .strict();

const header = (h: GatewayRequest['headers'], name: string): string | undefined => {
  const v = h[name] ?? h[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
};

const err = (status: number, type: string, message: string, extra: Record<string, string> = {}): GatewayResponse => ({
  status,
  headers: extra,
  body: { error: { message, type } },
});

/** Role-based default trust. Assistant turns come from the integrating app, so they are not "untrusted". */
export function defaultTrust(role: string): TrustLevel {
  if (role === 'system') return 'SYSTEM';
  if (role === 'tool') return 'TOOL_OUTPUT';
  return 'USER';
}

/**
 * The app may LOWER trust (e.g. mark a user message as RETRIEVED_DOC). It cannot raise it:
 * tool messages never become USER/SYSTEM, and nothing but a system message is SYSTEM.
 */
export function resolveTrust(role: string, requested: TrustLevel | null | undefined): { trust: TrustLevel; warning?: string } {
  const base = defaultTrust(role);
  if (!requested || requested === base) return { trust: base };
  const lowering = requested === 'TOOL_OUTPUT' || requested === 'RETRIEVED_DOC' || requested === 'UNKNOWN';
  if (lowering) return { trust: requested };
  if (requested === 'USER' && (role === 'user' || role === 'assistant')) return { trust: 'USER' };
  return { trust: base, warning: `Ignored attempt to label a ${role} message as ${requested} (trust can only be lowered by the caller).` };
}

export function parseTrustHeader(value: string | undefined): { map: Map<number, TrustLevel>; errors: string[] } {
  const map = new Map<number, TrustLevel>();
  const errors: string[] = [];
  if (!value) return { map, errors };
  for (const part of value.split(',')) {
    const m = /^\s*(\d{1,3})\s*=\s*([A-Z_]+)\s*$/.exec(part);
    const parsed = m ? TrustEnum.safeParse(m[2]) : undefined;
    if (!m || !parsed?.success) {
      errors.push(`Invalid x-armora-trust entry "${part.trim().slice(0, 40)}" (expected index=TRUST)`);
      continue;
    }
    map.set(Number(m[1]), parsed.data);
  }
  return { map, errors };
}

function contentToString(c: z.infer<typeof ChatMessage>['content']): string | null {
  if (c === null || c === undefined) return '';
  if (typeof c === 'string') return c;
  const parts: string[] = [];
  for (const p of c) {
    if (p.type !== 'text' || typeof p.text !== 'string') return null; // images/audio are not supported
    parts.push(p.text);
  }
  return parts.join('\n');
}

const WORST: Record<string, number> = { allow: 0, approve: 1, deny: 2 };

export async function handleChatCompletions(deps: GatewayDeps, req: GatewayRequest): Promise<GatewayResponse> {
  const parsed = ChatBody.safeParse(req.body);
  if (!parsed.success) {
    return err(400, 'invalid_request_error', parsed.error.issues.map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`).join('; '));
  }
  const body = parsed.data;
  if (body.stream === true) {
    return err(501, 'not_implemented', 'Streaming responses are ROADMAP: output must be inspected before it is released, which needs buffering. Send stream:false.');
  }

  // headers
  const sessionHeader = header(req.headers, 'x-armora-session');
  if (sessionHeader !== undefined && !ID_RE.test(sessionHeader)) return err(400, 'invalid_request_error', 'Invalid x-armora-session');
  const agentId = header(req.headers, 'x-armora-agent') ?? 'agent_gateway_default';
  if (!ID_RE.test(agentId)) return err(400, 'invalid_request_error', 'Invalid x-armora-agent');
  const modeHeader = header(req.headers, 'x-armora-mode');
  let mode: FirewallMode = 'enforce';
  if (modeHeader !== undefined) {
    if (modeHeader === 'shadow' || modeHeader === 'enforce') mode = modeHeader;
    else if (modeHeader === 'off' && deps.demoMode) mode = 'off';
    else return err(400, 'invalid_request_error', 'x-armora-mode must be shadow or enforce (off requires DEMO_MODE)');
  }

  // trust labels: header first, then metadata
  const hdr = parseTrustHeader(header(req.headers, 'x-armora-trust'));
  if (hdr.errors.length) return err(400, 'invalid_request_error', hdr.errors.join('; '));
  const meta = body.metadata?.armora_trust;
  const requested = new Map<number, TrustLevel>();
  if (Array.isArray(meta)) meta.forEach((t, i) => t && requested.set(i, t));
  else if (meta) {
    for (const [k, v] of Object.entries(meta)) {
      if (!/^\d{1,3}$/.test(k)) return err(400, 'invalid_request_error', `metadata.armora_trust key "${k}" must be a message index`);
      requested.set(Number(k), v);
    }
  }
  for (const [k, v] of hdr.map) requested.set(k, v);
  for (const idx of requested.keys()) {
    if (idx >= body.messages.length) return err(400, 'invalid_request_error', `Trust label index ${idx} is out of range`);
  }

  const warnings: string[] = [];
  const messages: Array<{ role: string; content: string }> = [];
  const segments: Segment[] = [];
  for (const [i, m] of body.messages.entries()) {
    const text = contentToString(m.content);
    if (text === null) return err(400, 'invalid_request_error', `messages[${i}].content: only text content is supported`);
    const { trust, warning } = resolveTrust(m.role, requested.get(i));
    if (warning) warnings.push(`messages[${i}]: ${warning}`);
    messages.push({ role: m.role, content: text });
    segments.push({
      id: `seg_${sha256Hex(`${m.role}|${text}`).slice(0, 10)}`,
      role: trust === 'RETRIEVED_DOC' ? 'retrieved_doc' : (m.role as Segment['role']),
      content: text,
      trust,
      labelSource: requested.has(i) ? 'caller-labelled' : 'role-inferred',
    });
  }

  // session
  let session = sessionHeader ? deps.service.getSession(sessionHeader) : undefined;
  if (sessionHeader && !session) return err(404, 'not_found', 'Unknown x-armora-session');
  session ??= deps.service.createSession({ agentId, firewallMode: mode });
  deps.service.ingest(session.id, segments);

  // agent
  const model = body.model ?? 'armora-mock';
  let text: string;
  let toolCalls: ToolCall[];
  let source: 'mock' | 'gemini' | 'mock-fallback' = 'mock';
  const wantsGemini = /^gemini/i.test(model);
  if (wantsGemini && deps.geminiAvailable?.() && deps.callGemini) {
    try {
      text = await deps.callGemini(model, messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n'));
      const call = extractToolCallFromText(text);
      toolCalls = call ? [call] : [];
      source = 'gemini';
    } catch (e) {
      const fb = mockAgentRespond(messages);
      text = fb.text;
      toolCalls = fb.toolCalls;
      source = 'mock-fallback';
      warnings.push(`FALLBACK: Gemini call failed (${e instanceof Error ? e.message.slice(0, 120) : 'error'}); this response is from the SIMULATED agent, NOT Gemini.`);
    }
  } else {
    const r = mockAgentRespond(messages);
    text = r.text;
    toolCalls = r.toolCalls;
    if (wantsGemini) {
      source = 'mock-fallback';
      warnings.push('FALLBACK: Gemini is unavailable; this response is from the SIMULATED agent, NOT Gemini.');
    }
  }

  // output inspection (text and outbound email bodies)
  const allowedHosts = deps.allowedHosts();
  const inspections: Array<{ source: string; inspection: OutputInspection }> = [];
  const textInspection = inspectOutput(text, allowedHosts);
  inspections.push({ source: 'message', inspection: textInspection });
  text = textInspection.after;
  for (const c of toolCalls) {
    if (c.tool === 'send_email' && typeof c.args.body === 'string') {
      const insp = inspectOutput(c.args.body, allowedHosts);
      inspections.push({ source: 'email_body', inspection: insp });
      if (insp.changed) c.args.body = insp.after;
    }
  }
  const rewritten = inspections.some((i) => i.inspection.changed);
  deps.ledger.record({
    sessionId: session.id,
    type: 'LLM_RESPONSE',
    agentId: session.agentId,
    action: 'chat_completion',
    data: { source, model, toolCalls: toolCalls.map((c) => c.tool), textLength: text.length },
  });
  deps.ledger.record({
    sessionId: session.id,
    type: 'OUTPUT_INSPECTED',
    agentId: session.agentId,
    action: rewritten ? 'rewritten' : 'clean',
    data: { source: 'chat_completion', changed: rewritten, changeCount: inspections.reduce((n, i) => n + i.inspection.changes.length, 0), hosts: inspections.flatMap((i) => i.inspection.changes.map((c) => c.host)) },
  });

  // annotate tool calls with the gate decision (preview; nothing is executed here)
  let worst = 'allow' as GateDecision['action'];
  const annotated = toolCalls.map((c) => {
    const p = deps.service.preview(session!.id, c);
    if (WORST[p.decision.action] > WORST[worst]) worst = p.decision.action;
    return {
      id: `call_${crypto.randomBytes(6).toString('hex')}`,
      type: 'function' as const,
      function: { name: c.tool, arguments: JSON.stringify(c.args) },
      armora: {
        decision: p.decision.action,
        ruleId: p.decision.ruleId,
        reason: p.decision.reason,
        riskLevel: p.decision.riskLevel,
        matchedRules: (p.decision.matchedRules ?? []).map((m) => ({ ruleId: m.ruleId, action: m.action })),
        argProvenance: {
          argDerivedFromUntrusted: p.provenance.argDerivedFromUntrusted,
          matches: p.provenance.matches.filter((m) => m.untrusted).map((m) => ({ arg: m.arg, segmentId: m.segmentId, start: m.start, end: m.end, method: m.method })),
          note: p.provenance.note,
        },
        executable: p.decision.action !== 'deny',
        execute: { method: 'POST', path: '/v1/tools/execute', body: { sessionId: session!.id, tool: c.tool, args: c.args } },
      },
    };
  });

  return {
    status: 200,
    headers: {
      'x-armora-decision': worst,
      'x-armora-session': session.id,
      'x-armora-agent-source': source,
      'x-armora-output': rewritten ? 'rewritten' : 'clean',
      'x-armora-risk': worst === 'deny' ? 'HIGH' : session.maxInjectionScore >= 0.4 ? 'MEDIUM' : 'LOW',
    },
    body: {
      id: `chatcmpl-${crypto.randomBytes(8).toString('hex')}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: text, ...(annotated.length ? { tool_calls: annotated } : {}) },
          finish_reason: annotated.length ? 'tool_calls' : 'stop',
        },
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      armora: {
        sessionId: session.id,
        decision: worst,
        agentSource: source,
        injectionScore: session.maxInjectionScore,
        findings: session.findings.length,
        untrustedIngested: session.state.untrustedIngested,
        privateDataAccessed: session.state.privateDataAccessed,
        outputInspection: inspections.filter((i) => i.inspection.changed).map((i) => ({ source: i.source, changes: i.inspection.changes.map((c) => ({ kind: c.kind, host: c.host, action: c.action })) })),
        warnings,
      },
    },
  };
}

/** Result shape visible to agents: no credential info, no provider receipts. */
export function sanitizeResult(r: ToolResult | undefined): { success: boolean; data?: unknown; error?: string; simulation?: string } | undefined {
  if (!r) return undefined;
  let data = r.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const { providerReceipt: _p, ...rest } = data as Record<string, unknown>;
    data = rest;
  }
  return { success: r.success, ...(data !== undefined ? { data } : {}), ...(r.error ? { error: r.error } : {}), ...(r.simulation ? { simulation: r.simulation } : {}) };
}

export function outcomeToResponse(o: ExecutionOutcome): GatewayResponse {
  const status = o.status === 'executed' ? 200 : o.status === 'blocked' ? 403 : o.status === 'pending_approval' ? 202 : 422;
  return {
    status,
    headers: { 'x-armora-decision': o.decision.action, 'x-armora-session': o.sessionId },
    body: {
      status: o.status,
      callId: o.callId,
      sessionId: o.sessionId,
      decision: {
        action: o.decision.action,
        ruleId: o.decision.ruleId,
        reason: o.decision.reason,
        riskLevel: o.decision.riskLevel,
        matchedRules: (o.decision.matchedRules ?? []).map((m) => ({ ruleId: m.ruleId, action: m.action })),
      },
      argProvenance: {
        argDerivedFromUntrusted: o.provenance.argDerivedFromUntrusted,
        matches: o.provenance.matches.filter((m) => m.untrusted).map((m) => ({ arg: m.arg, segmentId: m.segmentId, start: m.start, end: m.end, method: m.method })),
        note: o.provenance.note,
      },
      ...(o.approvalId ? { approvalId: o.approvalId, approval: { poll: `/v1/approvals/${o.approvalId}`, resolve: 'POST /api/approvals/{approvalId} (admin)' } } : {}),
      result: sanitizeResult(o.toolResult),
      credential: { type: 'one-time Ed25519 token, minted and redeemed inside the gateway', exposedToAgent: false },
    },
  };
}

export async function handleToolsExecute(deps: GatewayDeps, req: GatewayRequest): Promise<GatewayResponse> {
  const parsed = ExecBody.safeParse(req.body);
  if (!parsed.success) {
    return err(400, 'invalid_request_error', parsed.error.issues.map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`).join('; '));
  }
  const agentId = header(req.headers, 'x-armora-agent') ?? 'agent_gateway_default';
  if (!ID_RE.test(agentId)) return err(400, 'invalid_request_error', 'Invalid x-armora-agent');
  let session = parsed.data.sessionId ? deps.service.getSession(parsed.data.sessionId) : undefined;
  if (parsed.data.sessionId && !session) return err(404, 'not_found', 'Unknown sessionId');
  // no sessionId: a fresh session with no ingested content (direct, trusted call)
  session ??= deps.service.createSession({ agentId, firewallMode: 'enforce' });
  const outcome = await deps.service.execute({ sessionId: session.id, toolCall: { tool: parsed.data.tool, args: parsed.data.args } });
  return outcomeToResponse(outcome);
}

export function handleApprovalStatus(deps: GatewayDeps, id: string): GatewayResponse {
  if (!ID_RE.test(id)) return err(400, 'invalid_request_error', 'Invalid approval id');
  const item = deps.service.getApproval(id);
  if (!item) return err(404, 'not_found', 'Unknown approval');
  return {
    status: 200,
    headers: {},
    body: {
      approvalId: item.id,
      status: item.status,
      sessionId: item.sessionId,
      tool: item.toolCall.tool,
      expiresAt: new Date(item.expiresAt).toISOString(),
      result: sanitizeResult(item.result),
    },
  };
}
