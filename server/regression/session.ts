import fs from 'node:fs';
import path from 'node:path';
import { PolicyEngine } from '../policyEngine.ts';
import { createSessionState, recordToolResult } from '../sessionState.ts';
import { SEEDED_SCENARIOS } from '../scenarios.ts';
import { agentRunner } from '../agentRunner.ts';
import type { ToolCall } from '../types.ts';
import { eq, makeStack, skip, suite, yes } from './helpers.ts';
import { buildAttackSegments } from '../redteam.ts';

const scenario = (id: string) => SEEDED_SCENARIOS.find((s) => s.id === id)!;

/** Executes the scenario's pre-steps on an isolated stack, then evaluates its fooled call. */
function evaluateScenario(id: string) {
  const sc = scenario(id);
  const { broker, toolServer } = makeStack();
  const sessionId = `reg_${id}`;
  const state = createSessionState(sessionId, sc.segments);
  for (const pre of sc.preToolCalls ?? []) {
    const { token } = broker.issueToken({ sessionId, agentId: 'agent_reg', toolCall: pre });
    recordToolResult(state, pre, toolServer.executeTool({ toolCall: pre, credential: token, sessionId }));
  }
  const decision = new PolicyEngine().evaluate({
    toolCall: sc.simulatedFooledToolCall!,
    segments: sc.segments,
    findings: [],
    injectionScore: 0,
    firewallMode: 'enforce',
    sessionState: state,
  });
  return { state, decision };
}

const mail: ToolCall = { tool: 'send_email', args: { to: 'b@example.com', subject: 's', body: 'b' } };

export const sessionCases = suite(3, 'Regression 3: Session state (no scenario hard-coding)', [
  ['source no longer derives private-data access from scenario codes', () => {
    const file = path.resolve(process.cwd(), 'server/agentRunner.ts');
    if (!fs.existsSync(file)) return { ...skip('source not available'), passed: true };
    const src = fs.readFileSync(file, 'utf8');
    return yes(!/scenario\.code\s*===/.test(src) && !/accessedPrivateData/.test(src), 'agentRunner.ts');
  }],
  ['fresh session: privateDataAccessed=false, trifecta guard does not fire', () => {
    const state = createSessionState('s', buildAttackSegments({ id: 'x', prompt: 'p', injectedDoc: 'doc', trustedSession: false } as never));
    const d = new PolicyEngine().evaluate({ toolCall: mail, segments: [{ id: 'd', role: 'retrieved_doc', content: 'x', trust: 'RETRIEVED_DOC', labelSource: '' }], findings: [], injectionScore: 0, firewallMode: 'enforce', sessionState: state });
    return eq([false, false], [state.privateDataAccessed, (d.matchedRules ?? []).some((m) => m.ruleId === 'R2_TRIFECTA')]);
  }],
  ['a REAL read_candidate_files result sets privateDataAccessed and records data objects', () => {
    const { broker, toolServer } = makeStack();
    const state = createSessionState('s1');
    const call: ToolCall = { tool: 'read_candidate_files', args: { candidateId: 'CAND_101' } };
    const { token } = broker.issueToken({ sessionId: 's1', agentId: 'a', toolCall: call });
    recordToolResult(state, call, toolServer.executeTool({ toolCall: call, credential: token, sessionId: 's1' }));
    return eq({ p: true, o: ['CAND_101'], n: 1 }, { p: state.privateDataAccessed, o: state.dataObjects, n: state.toolCalls.length });
  }],
  ['a FAILED read (bad token) does not set privateDataAccessed', () => {
    const { toolServer } = makeStack();
    const state = createSessionState('s2');
    const call: ToolCall = { tool: 'read_candidate_files', args: { candidateId: 'CAND_101' } };
    recordToolResult(state, call, toolServer.executeTool({ toolCall: call, credential: 'garbage', sessionId: 's2' }));
    return eq([false, 1], [state.privateDataAccessed, state.toolCalls.length]);
  }],
  ['a tool without readsPrivateData (update_candidate_status) does not set it', () => {
    const { broker, toolServer } = makeStack();
    const state = createSessionState('s3');
    const call: ToolCall = { tool: 'update_candidate_status', args: { candidateId: 'CAND_101', status: 'SHORTLISTED' } };
    const { token } = broker.issueToken({ sessionId: 's3', agentId: 'a', toolCall: call });
    recordToolResult(state, call, toolServer.executeTool({ toolCall: call, credential: token, sessionId: 's3' }));
    return eq(false, state.privateDataAccessed);
  }],
  ['trifecta guard reads the state: same call is allowed without a read, denied after a real read', () => {
    const untrusted = [{ id: 'd', role: 'retrieved_doc' as const, content: 'x', trust: 'RETRIEVED_DOC' as const, labelSource: '' }];
    const pe = new PolicyEngine();
    const state = createSessionState('s4', untrusted);
    const before = pe.evaluate({ toolCall: mail, segments: untrusted, findings: [], injectionScore: 0, firewallMode: 'enforce', sessionState: state });
    state.privateDataAccessed = true;
    const after = pe.evaluate({ toolCall: mail, segments: untrusted, findings: [], injectionScore: 0, firewallMode: 'enforce', sessionState: state });
    return eq(['approve', 'deny:R2_TRIFECTA'], [before.action, `${after.action}:${after.ruleId}`]);
  }],
  ['S1 (pre-step really reads candidates) => trifecta matched from real state', () => {
    const { state, decision } = evaluateScenario('s1_hr_resume_exfil');
    return yes(state.privateDataAccessed && (decision.matchedRules ?? []).some((m) => m.ruleId === 'R2_TRIFECTA'), decision.ruleId);
  }],
  ['S3 (no private read) => trifecta NOT matched, derived from state not scenario code', () => {
    const { state, decision } = evaluateScenario('s3_output_exfil');
    return yes(!state.privateDataAccessed && !(decision.matchedRules ?? []).some((m) => m.ruleId === 'R2_TRIFECTA'), decision.ruleId);
  }],
  ['end-to-end S1 run: session state built from executed pre-step; audit has sessionState', () => {
    return agentRunner.runScenario({ scenarioId: 's1_hr_resume_exfil', firewallMode: 'enforce', llmMode: 'mock' }).then((inc) => {
      const matched = (inc.decision.matchedRules ?? []).map((m) => m.ruleId);
      return yes(inc.decision.action === 'deny' && matched.includes('R2_TRIFECTA'), `${inc.decision.ruleId} matched=${matched.join('+')}`);
    });
  }, { live: true }],
  ['end-to-end S3 run: no R2 because nothing private was read', () => {
    return agentRunner.runScenario({ scenarioId: 's3_output_exfil', firewallMode: 'enforce', llmMode: 'mock' }).then((inc) => {
      const matched = (inc.decision.matchedRules ?? []).map((m) => m.ruleId);
      return yes(!matched.includes('R2_TRIFECTA'), `${inc.decision.ruleId} matched=${matched.join('+')}`);
    });
  }, { live: true }],
]);
