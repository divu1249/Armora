import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CredentialBroker, TokenVerifier } from '../credentialBroker.ts';
import { ProtectedToolServer } from '../protectedTools.ts';
import type { Segment, ToolCall } from '../types.ts';
import { AuditHashChain } from '../auditLog.ts';
import { EventLedger } from '../ledger.ts';
import { Vault } from '../vault.ts';
import { PolicyEngine } from '../policyEngine.ts';
import { createExecutionStack } from '../executionService.ts';
import type { ScenarioDefinition } from '../scenarios.ts';

export interface RegressionResult {
  passed: boolean;
  expected: unknown;
  actual: unknown;
  details?: string;
  /** environment cannot run this check (e.g. repo files absent in a production image) */
  skipped?: boolean;
}

export interface RegressionCase {
  /** the numbered item from the defect list (0-9) */
  item: number;
  suite: string;
  name: string;
  /** touches live singletons (audit log, incident store): run under vitest only, never from /selftest */
  live?: boolean;
  run: () => RegressionResult | Promise<RegressionResult>;
}

export const eq = (expected: unknown, actual: unknown, details?: string): RegressionResult => ({
  passed: JSON.stringify(expected) === JSON.stringify(actual),
  expected,
  actual,
  details,
});
export const yes = (actual: boolean, details?: string): RegressionResult => eq(true, actual, details);
export const skip = (why: string): RegressionResult => ({ passed: true, expected: 'n/a', actual: 'n/a', details: `SKIPPED: ${why}`, skipped: true });

export function suite(
  item: number,
  name: string,
  cases: Array<[string, () => RegressionResult | Promise<RegressionResult>] | [string, () => RegressionResult | Promise<RegressionResult>, { live?: boolean }]>
): RegressionCase[] {
  return cases.map((c) => ({ item, suite: name, name: c[0], run: c[1], live: (c[2] as { live?: boolean } | undefined)?.live }));
}

export const seg = (id: string, trust: Segment['trust'], content = 'text'): Segment => ({
  id,
  role: trust === 'USER' ? 'user' : 'retrieved_doc',
  content,
  trust,
  labelSource: 'app-marked',
});
export const TRUSTED: Segment[] = [seg('u', 'USER', 'please help')];
export const UNTRUSTED: Segment[] = [seg('u', 'USER', 'please help'), seg('d', 'RETRIEVED_DOC', 'some retrieved document')];

export const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

/** Isolated broker + verifier + tool server with an injectable clock. */
export function makeStack(seed: Buffer = crypto.randomBytes(32)) {
  const clock = { t: Date.now() };
  const broker = new CredentialBroker({ seed, quiet: true, now: () => clock.t });
  const verifier = new TokenVerifier(broker.createPublicView(), broker.createPublicView(), { now: () => clock.t });
  const toolServer = new ProtectedToolServer(verifier);
  return { clock, broker, verifier, toolServer, seed };
}

/** Sign arbitrary claims/headers with the key derived from `seed` (to craft malicious-but-signed tokens). */
export function signCustom(seed: Buffer, header: Record<string, unknown>, claims: Record<string, unknown>): string {
  const key = crypto.createPrivateKey({ key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]), format: 'der', type: 'pkcs8' });
  const h = Buffer.from(JSON.stringify(header)).toString('base64url');
  const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${h}.${p}.${crypto.sign(null, Buffer.from(`${h}.${p}`), key).toString('base64url')}`;
}

export function tmpDir(prefix = 'armora-reg-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export const JWT_LIKE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}/;

/** Fully isolated stack: own audit chain, ledger, vault, broker, verifier, tool server, execution service. */
export function makeServiceStack(opts: { engine?: PolicyEngine; isQuarantined?: (agentId: string) => boolean; dir?: string; key?: Buffer } = {}) {
  const clock = { t: Date.now() };
  const key = opts.key ?? crypto.randomBytes(32);
  const audit = new AuditHashChain({ key, quiet: true, dir: opts.dir ?? null, anchorEvery: 5 });
  const ledger = new EventLedger({ audit, now: () => clock.t, dir: opts.dir ?? null });
  const vault = new Vault();
  const seed = crypto.randomBytes(32);
  const broker = new CredentialBroker({ seed, quiet: true, now: () => clock.t });
  const stack = createExecutionStack({ ledger, vault, broker, engine: opts.engine, now: () => clock.t, isQuarantined: opts.isQuarantined });
  return { clock, audit, ledger, vault, key, seed, ...stack };
}
export type ServiceStack = ReturnType<typeof makeServiceStack>;

/** Plays a scenario's tool steps and its fooled agent call through the isolated service. */
export async function playScenario(st: ServiceStack, scenario: ScenarioDefinition, mode: 'enforce' | 'shadow' | 'off' = 'enforce') {
  const session = st.service.createSession({ agentId: `agent_${scenario.id}`, firewallMode: mode, scenarioId: scenario.id, segments: scenario.segments });
  const outcomes = [];
  for (const step of scenario.steps ?? []) {
    if (step.kind === 'tool') outcomes.push(await st.service.execute({ sessionId: session.id, toolCall: structuredClone(step.toolCall) }));
    if (step.kind === 'agent') outcomes.push(await st.service.execute({ sessionId: session.id, toolCall: structuredClone(scenario.simulatedFooledToolCall as ToolCall) }));
  }
  return { session, outcomes };
}
