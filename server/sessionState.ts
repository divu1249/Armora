import type { Segment, SessionState, ToolCall, ToolResult } from './types.ts';
import { TOOL_TAXONOMY } from './taxonomy.ts';

const UNTRUSTED = new Set(['TOOL_OUTPUT', 'RETRIEVED_DOC', 'UNKNOWN']);

export function isUntrusted(segment: Segment): boolean {
  return UNTRUSTED.has(segment.trust);
}

export function createSessionState(sessionId: string, segments: Segment[] = []): SessionState {
  return {
    sessionId,
    untrustedIngested: segments.some(isUntrusted),
    privateDataAccessed: false,
    toolCalls: [],
    dataObjects: [],
  };
}

export function collectDataObjects(data: unknown): string[] {
  const ids: string[] = [];
  const visit = (v: unknown): void => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    const rec = v as Record<string, unknown>;
    if (typeof rec.id === 'string' && /^CAND_/.test(rec.id)) ids.push(rec.id);
    if (typeof rec.orderId === 'string') ids.push(rec.orderId);
    if (Array.isArray(rec.candidates)) visit(rec.candidates);
  };
  visit(data);
  return ids;
}

/**
 * Update session state from an ACTUAL tool result. privateDataAccessed becomes true
 * only when a tool with readsPrivateData really returned data.
 */
export function recordToolResult(state: SessionState, toolCall: ToolCall, result: ToolResult): void {
  const readsPrivateData = TOOL_TAXONOMY[toolCall.tool]?.readsPrivateData === true;
  state.toolCalls.push({ tool: toolCall.tool, ts: new Date().toISOString(), success: result.success, readsPrivateData });
  if (result.success && readsPrivateData) {
    state.privateDataAccessed = true;
    for (const id of collectDataObjects(result.data)) {
      if (!state.dataObjects.includes(id)) state.dataObjects.push(id);
    }
  }
}

export function markUntrustedIngested(state: SessionState): void {
  state.untrustedIngested = true;
}
