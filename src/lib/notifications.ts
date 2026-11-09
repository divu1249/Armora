import type { ApprovalItem, Incident } from '../../server/types.ts';

export interface Notification {
  id: string;
  kind: 'approval' | 'incident';
  title: string;
  detail: string;
  to: string;
  ts: number;
  unread: boolean;
}

/**
 * Bell contents: every pending approval, plus incidents newer than the last time the user opened the bell.
 * Seeded sample incidents never raise notifications.
 */
export function buildNotifications(params: { pending: readonly ApprovalItem[]; incidents: readonly Incident[]; lastSeenTs: number; limit?: number }): Notification[] {
  const out: Notification[] = [];
  for (const a of params.pending) {
    out.push({ id: `approval:${a.id}`, kind: 'approval', title: `Approval needed: ${a.toolCall.tool}`, detail: a.reason.slice(0, 120), to: '/app/approvals', ts: a.createdAt, unread: true });
  }
  for (const i of params.incidents) {
    if (i.isSeeded) continue;
    const t = Date.parse(i.timestamp);
    out.push({
      id: `incident:${i.id}`,
      kind: 'incident',
      title: `${i.decision.action === 'deny' ? 'Blocked' : i.decision.action === 'approve' ? 'Held' : 'Allowed'}: ${i.scenarioTitle}`,
      detail: `${i.decision.ruleId} · ${i.firewallMode}`,
      to: `/app/incidents/${i.id}`,
      ts: t,
      unread: t > params.lastSeenTs,
    });
  }
  return out.sort((a, b) => b.ts - a.ts).slice(0, params.limit ?? 20);
}

export const unreadCount = (n: readonly Notification[]) => n.filter((x) => x.unread).length;
