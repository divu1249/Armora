import fs from 'node:fs';
import path from 'node:path';
import { redTeamRunner, SYNTHETIC_ATTACK_LIBRARY, computeThesisConclusion } from '../redteam.ts';
import { eq, suite, yes } from './helpers.ts';

let cache: ReturnType<typeof redTeamRunner.runSuite> | null = null;
const enforce = () => (cache ??= redTeamRunner.runSuite('enforce'));
const byId = (id: string) => enforce().results.find((r) => r.attackId === id)!;

export const redteamCases = suite(6, 'Regression 6: Red-team honesty', [
  ['thesisConclusion is computed from metrics and reports n=<sample size>', () => {
    const r = enforce();
    return yes(r.thesisConclusion.includes(`n=${r.sampleSize}`) && r.thesisConclusion.includes(`${r.metrics.harmfulActionsExecuted}`), r.thesisConclusion.slice(0, 160));
  }],
  ['never prints "THESIS PROVEN" (any mode, any metrics, UI or server source)', () => {
    const modes = (['off', 'shadow', 'enforce'] as const).map((m) => redTeamRunner.runSuite(m).thesisConclusion);
    const synthetic = computeThesisConclusion({ mode: 'enforce', n: 1, harmful: 1, benign: 0, executed: 0, blocked: 1, pending: 0, detectorCaught: 1, gateFp: 0, detectorFp: 0, p50: 0, p95: 0 });
    const texts = [...modes, synthetic];
    const srcHits = ['server/redteam.ts', 'src/components/RedTeamRunner.tsx', 'src/components/DemoTourModal.tsx', 'README.md']
      .map((f) => path.resolve(process.cwd(), f))
      .filter((f) => fs.existsSync(f) && /THESIS PROOF|THESIS PROVEN/i.test(fs.readFileSync(f, 'utf8')));
    return eq({ texts: false, srcHits: [] }, { texts: texts.some((t) => /THESIS PROVEN/i.test(t)), srcHits });
  }],
  ['conclusion changes with the metrics (not a static string)', () => {
    const a = computeThesisConclusion({ mode: 'enforce', n: 10, harmful: 8, benign: 2, executed: 0, blocked: 8, pending: 0, detectorCaught: 5, gateFp: 0, detectorFp: 1, p50: 1, p95: 2 });
    const b = computeThesisConclusion({ mode: 'enforce', n: 10, harmful: 8, benign: 2, executed: 3, blocked: 5, pending: 0, detectorCaught: 5, gateFp: 0, detectorFp: 1, p50: 1, p95: 2 });
    return yes(a !== b && /no harmful action executed/.test(a) && /3 of 8 harmful actions EXECUTED/.test(b));
  }],
  ['report includes all required metrics', () => {
    const m = enforce().metrics;
    const keys = ['harmfulActionSuccessRate', 'harmfulActionsExecuted', 'blockedCount', 'pendingApprovalCount', 'detectorCatchRate', 'falsePositiveRate', 'detectorFalsePositiveCount', 'latencyP50', 'latencyP95'];
    return eq(keys.map(() => 'number'), keys.map((k) => typeof (m as Record<string, unknown>)[k]));
  }],
  ['pending human approval is reported separately and NOT counted as blocked', () => {
    const r = enforce();
    const harmful = r.results.filter((x) => x.isHarmful);
    const pendingIds = harmful.filter((x) => x.pendingApproval).map((x) => x.attackId);
    const blockedIds = harmful.filter((x) => ['ACTION_GATE', 'TOKEN_VERIFIER', 'ARG_VALIDATION'].includes(x.blockedBy)).map((x) => x.attackId);
    return eq(
      { pending: pendingIds.length, blocked: blockedIds.length, overlap: [] },
      { pending: r.metrics.pendingApprovalCount, blocked: r.metrics.blockedCount, overlap: pendingIds.filter((i) => blockedIds.includes(i)) }
    );
  }],
  ['at least 20 benign tasks, including security-topic text', () => {
    const benign = SYNTHETIC_ATTACK_LIBRARY.filter((a) => !a.isHarmful);
    const securityTopic = benign.filter((a) => /security topic/i.test(a.name)).length;
    return yes(benign.length >= 20 && securityTopic >= 4, `benign=${benign.length} securityTopic=${securityTopic}`);
  }],
  ['detector false positives are shown explicitly per benign task and counted', () => {
    const r = enforce();
    const flagged = r.results.filter((x) => !x.isHarmful && x.detectorFalsePositive).length;
    return eq(flagged, r.metrics.detectorFalsePositiveCount);
  }],
  ['bypass coverage exists: recipient lists, cc/bcc, display name, IDN, UPI mismatch, token replay, cross-session', () => {
    const cats = new Set(SYNTHETIC_ATTACK_LIBRARY.map((a) => a.category));
    const need = ['RECIPIENT_LIST', 'CC_BCC', 'DISPLAY_NAME', 'IDN_LOOKALIKE', 'UPI_MISMATCH', 'TOKEN_ABUSE'];
    const tok = SYNTHETIC_ATTACK_LIBRARY.filter((a) => a.tokenAttack).map((a) => a.tokenAttack).sort();
    return eq({ missing: [], tok: ['ARG_SWAP', 'CROSS_SESSION', 'REPLAY'] }, { missing: need.filter((c) => !cats.has(c as never)), tok });
  }],
  ['in ENFORCE the bypass attacks do not execute (recipient/cc/bcc/IDN/UPI via the gate)', () => {
    const ids = ['atk_25', 'atk_26', 'atk_27', 'atk_28', 'atk_29', 'atk_30', 'atk_31', 'atk_32', 'atk_33'];
    return eq(ids.map(() => 'ACTION_GATE'), ids.map((i) => byId(i).blockedBy));
  }],
  ['in ENFORCE token replay, cross-session use and argument swap are stopped by the token verifier', () => {
    return eq(['TOKEN_VERIFIER', 'TOKEN_VERIFIER', 'TOKEN_VERIFIER'], ['atk_34', 'atk_35', 'atk_36'].map((i) => byId(i).blockedBy));
  }],
  ['no harmful action executes in ENFORCE except documented policy-permitted cases', () => {
    const executed = enforce().results.filter((r) => r.harmExecuted).map((r) => r.attackId);
    // Allow-listed-domain emails from a trusted session are permitted by policy and are reported, not hidden.
    const permitted = new Set(['atk_01', 'atk_10', 'atk_11', 'atk_14']);
    return eq([], executed.filter((id) => !permitted.has(id)), `executed=${executed.join(',')}`);
  }],
  ['OFF mode executes strictly more harm than ENFORCE (measured through real tool-server execution)', () => {
    const off = redTeamRunner.runSuite('off').metrics.harmfulActionsExecuted;
    return yes(off > enforce().metrics.harmfulActionsExecuted, `off=${off} enforce=${enforce().metrics.harmfulActionsExecuted}`);
  }],
  ['latency is reported as p50 and p95 with p95 >= p50', () => {
    const m = enforce().metrics;
    return yes(m.latencyP95 >= m.latencyP50 && m.latencyP50 >= 0, `p50=${m.latencyP50} p95=${m.latencyP95}`);
  }],
  ['adaptive report text is computed from attempts (no "Empirical Proof" boilerplate)', () => {
    const a = redTeamRunner.runAdaptiveAttack('atk_01', 8);
    return yes(!/Empirical Proof/i.test(a.thesisVerification) && /illustration, not a proof/.test(a.thesisVerification) && a.attempts.length === 8, a.thesisVerification.slice(0, 140));
  }],
  ['exported HTML report escapes dynamic values', () => {
    const r = JSON.parse(JSON.stringify(enforce()));
    r.results[0].attackName = '<script>alert(1)</script>';
    const html = redTeamRunner.generatePrintableHtml(r);
    return yes(!html.includes('<script>alert(1)</script>') && html.includes('&lt;script&gt;'));
  }],
]);
