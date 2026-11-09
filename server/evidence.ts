import type { AuditHashChain, EntryProof } from './auditLog.ts';
import type { EventLedger, LedgerEvent } from './ledger.ts';
import { eventDigest } from './ledger.ts';
import { buildBlastRadius, buildReportDrafts, buildTimeline, REPORT_DISCLAIMER } from './blastRadius.ts';
import { canonicalJson, sha256Hex } from './canonical.ts';
import type { OutboxEmail, RefundRecord } from './protectedTools.ts';
import type { Incident } from './types.ts';

/**
 * Evidence bundle (JSON): everything needed to review one session offline.
 * It contains events, the audit entries that commit to them (with hash-path proofs), anchors,
 * the computed blast radius, timeline and report drafts. It never contains token strings or secrets.
 */
export interface EvidenceBundle {
  kind: 'armora-evidence-bundle';
  version: 1;
  generatedAt: string;
  disclaimer: string;
  sessionId: string;
  integrityNote: string;
  incident: Incident | null;
  events: LedgerEvent[];
  auditEntries: Array<{
    entry: ReturnType<AuditHashChain['getEntry']>;
    proof: Omit<EntryProof, 'entry' | 'path'> & { path: Array<{ seq: number; hash: string }>; pathTruncated: boolean };
  }>;
  anchors: ReturnType<AuditHashChain['getAnchors']>;
  auditVerification: ReturnType<AuditHashChain['verifyChain']>;
  ledgerVerification: ReturnType<EventLedger['verify']>;
  blastRadius: ReturnType<typeof buildBlastRadius>;
  timeline: ReturnType<typeof buildTimeline>;
  reportDrafts: ReturnType<typeof buildReportDrafts>;
  bundleDigest: string;
}

const INTEGRITY_NOTE =
  'Offline check: every event digest must equal the digest committed in its audit entry, and entries must link by prevHash. Keyed HMACs and anchor signatures can only be re-verified by the holder of the audit key.';

export function buildEvidenceBundle(
  deps: { ledger: EventLedger; audit: AuditHashChain; outbox: OutboxEmail[]; refunds: RefundRecord[]; incident?: Incident | null },
  sessionId: string
): EvidenceBundle {
  const events = deps.ledger.bySession(sessionId);
  const graph = buildBlastRadius(events, { incidentId: sessionId, sessionId, outbox: deps.outbox, refunds: deps.refunds });
  const auditEntries = events.map((e) => {
    const proof = deps.audit.proveEntry(e.auditSeq);
    const entry = deps.audit.getEntry(e.auditSeq);
    const { entry: _e, path, ...rest } = proof ?? ({ path: [] } as unknown as EntryProof);
    const capped = (path ?? []).slice(0, 200);
    return { entry, proof: { ...(rest as object), path: capped.map((p) => ({ seq: p.seq, hash: p.hash })), pathTruncated: (path ?? []).length > capped.length } as EvidenceBundle['auditEntries'][number]['proof'] };
  });
  const body = {
    kind: 'armora-evidence-bundle' as const,
    version: 1 as const,
    generatedAt: new Date().toISOString(),
    disclaimer: REPORT_DISCLAIMER,
    sessionId,
    integrityNote: INTEGRITY_NOTE,
    incident: deps.incident ?? null,
    events,
    auditEntries,
    anchors: deps.audit.getAnchors(),
    auditVerification: deps.audit.verifyChain(),
    ledgerVerification: deps.ledger.verify(),
    blastRadius: graph,
    timeline: buildTimeline(events),
    reportDrafts: buildReportDrafts(sessionId, events, graph, { scenarioTitle: deps.incident?.scenarioTitle, firewallMode: deps.incident?.firewallMode }),
  };
  return { ...body, bundleDigest: sha256Hex(canonicalJson(body)) };
}

/** Offline verification that needs no key: digests, commitments, links and the bundle digest. */
export function verifyEvidenceBundle(bundle: EvidenceBundle): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const { bundleDigest, ...body } = bundle;
  if (sha256Hex(canonicalJson(body)) !== bundleDigest) problems.push('bundleDigest does not match the bundle content');
  const bySeq = new Map(bundle.auditEntries.map((a) => [a.entry?.seq, a.entry]));
  for (const e of bundle.events) {
    const { digest, auditSeq, ...rest } = e;
    if (eventDigest(rest) !== digest) problems.push(`event ${e.id}: content does not match its digest`);
    const entry = bySeq.get(auditSeq);
    const d = entry?.data as Record<string, unknown> | undefined;
    if (!entry) problems.push(`event ${e.id}: audit entry ${auditSeq} missing from the bundle`);
    else if (d?.eventId !== e.id || d?.digest !== digest) problems.push(`event ${e.id}: audit entry does not commit to this event`);
  }
  const ordered = bundle.auditEntries.map((a) => a.entry).filter((x): x is NonNullable<typeof x> => Boolean(x)).sort((a, b) => a.seq - b.seq);
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].seq === ordered[i - 1].seq + 1 && ordered[i].prevHash !== ordered[i - 1].hash) problems.push(`audit entries ${ordered[i - 1].seq} -> ${ordered[i].seq} do not link`);
  }
  return { ok: problems.length === 0, problems };
}
