import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { AuditHashChain, AUDIT_ANCHOR_NOTE, AUDIT_INTEGRITY_NOTE, canonicalJson } from '../auditLog.ts';
import { eq, suite, tmpDir, yes } from './helpers.ts';

const KEY = Buffer.from('k'.repeat(32));

function build(n: number, opts: { anchorEvery?: number; key?: Buffer } = {}) {
  const dir = tmpDir();
  const chain = new AuditHashChain({ dir, key: opts.key ?? KEY, anchorEvery: opts.anchorEvery ?? 3, quiet: true });
  for (let i = 0; i < n; i++) {
    chain.appendEntry({ type: 'POLICY_DECISION', sessionId: `s${i}`, data: { ruleId: `R${i}`, action: i % 2 ? 'deny' : 'allow', n: i } });
  }
  return { dir, chain, entries: path.join(dir, 'entries.jsonl'), anchors: path.join(dir, 'anchors.jsonl') };
}
const reload = (dir: string, key: Buffer = KEY) => new AuditHashChain({ dir, key, anchorEvery: 3, quiet: true });
const lines = (f: string) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean);
const write = (f: string, ls: string[]) => fs.writeFileSync(f, ls.join('\n') + '\n');

export const auditCases = suite(5, 'Regression 5: Audit log (keyed, persisted, anchored)', [
  ['pristine chain verifies and entry hash is HMAC-SHA256(key, prevHash + canonical entry)', () => {
    const { chain } = build(5);
    const e = chain.getEntries()[3];
    const { hash, ...rest } = e;
    const expected = crypto.createHmac('sha256', KEY).update(rest.prevHash + canonicalJson(rest)).digest('hex');
    const plain = crypto.createHash('sha256').update(canonicalJson(rest)).digest('hex');
    return eq({ valid: true, hmac: true, plainSha: false }, { valid: chain.verifyChain().valid, hmac: hash === expected, plainSha: hash === plain });
  }],
  ['edit a middle entry on disk => detected at that entry', () => {
    const { dir, entries } = build(8);
    const ls = lines(entries);
    const e = JSON.parse(ls[4]);
    e.data.action = 'FORGED_ALLOW';
    ls[4] = JSON.stringify(e);
    write(entries, ls);
    const r = reload(dir).verifyChain();
    return eq({ valid: false, seq: 4 }, { valid: r.valid, seq: r.tamperedEntry?.seq }, r.reason);
  }],
  ['edit a middle entry in memory (demo tamper) => detected', () => {
    const { chain } = build(6);
    chain.tamperEntry(2, { action: 'FORGED' });
    const r = chain.verifyChain();
    return eq({ valid: false, seq: 2 }, { valid: r.valid, seq: r.tamperedEntry?.seq });
  }],
  ['rewrite and recompute ALL hashes without the key (plain SHA-256) => detected', () => {
    const { dir, entries } = build(8);
    const forged: string[] = [];
    let prev = '0'.repeat(64);
    for (const l of lines(entries)) {
      const e = JSON.parse(l);
      if (e.seq === 3) e.data = { ...e.data, action: 'FORGED_ALLOW' };
      e.prevHash = prev;
      const { hash: _h, ...rest } = e;
      e.hash = crypto.createHash('sha256').update(prev + canonicalJson(rest)).digest('hex');
      prev = e.hash;
      forged.push(JSON.stringify(e));
    }
    write(entries, forged);
    const r = reload(dir).verifyChain();
    return eq({ valid: false, seq: 0 }, { valid: r.valid, seq: r.tamperedEntry?.seq }, r.reason);
  }],
  ['delete the last N entries => detected via the anchor (tail truncation)', () => {
    const out: Array<[boolean, boolean]> = [];
    for (const n of [1, 2, 3]) {
      const { dir, entries, chain } = build(9); // 10 entries incl. genesis; periodic anchors at seq 2,5,8
      chain.createAnchor(); // on-demand anchor at the head (seq 9)
      write(entries, lines(entries).slice(0, -n));
      const r = reload(dir).verifyChain();
      out.push([r.valid, r.anchor.truncationDetected]);
    }
    return eq([[false, true], [false, true], [false, true]], out);
  }],
  ['without anchors a truncated chain still verifies (why anchors exist) and the note says so', () => {
    const { dir, entries, anchors } = build(9);
    write(entries, lines(entries).slice(0, -1));
    fs.rmSync(anchors);
    const r = reload(dir).verifyChain();
    return yes(r.valid === true && /external transparency log|RFC 3161/.test(r.anchorNote), 'deleting the anchors file too defeats the LOCAL witness; external anchoring is the production fix');
  }],
  ['reorder two entries => detected', () => {
    const { dir, entries } = build(8);
    const ls = lines(entries);
    [ls[3], ls[4]] = [ls[4], ls[3]];
    write(entries, ls);
    return eq(false, reload(dir).verifyChain().valid);
  }],
  ['duplicate an entry => detected', () => {
    const { dir, entries } = build(8);
    const ls = lines(entries);
    ls.splice(4, 0, ls[3]);
    write(entries, ls);
    return eq(false, reload(dir).verifyChain().valid);
  }],
  ['delete a middle entry => detected', () => {
    const { dir, entries } = build(8);
    const ls = lines(entries);
    ls.splice(4, 1);
    write(entries, ls);
    return eq(false, reload(dir).verifyChain().valid);
  }],
  ['restart: chain reloads from the JSONL file and verifies; appends continue the chain', () => {
    const { dir, chain } = build(7);
    const before = chain.getEntries().length;
    const again = reload(dir);
    const loaded = again.getEntries().length;
    again.appendEntry({ type: 'TOOL_INVOCATION', sessionId: 'after-restart', data: { tool: 'x' } });
    const third = reload(dir);
    return eq({ before, loaded, afterAppend: before + 1, valid: true }, { before, loaded, afterAppend: third.getEntries().length, valid: third.verifyChain().valid });
  }],
  ['restart with the WRONG key => chain reported invalid (not silently accepted)', () => {
    const { dir } = build(5);
    const r = reload(dir, Buffer.from('z'.repeat(32))).verifyChain();
    return eq(false, r.valid);
  }],
  ['corrupt / unreadable lines at boot are surfaced as invalid', () => {
    const { dir, entries } = build(4);
    fs.appendFileSync(entries, '{not json\n');
    const c = reload(dir);
    return eq(false, c.bootReport?.valid, c.bootReport?.reason);
  }],
  ['anchors: written every N entries and on demand to a SEPARATE file, signed {seq, headHash, ts}', () => {
    const { chain, anchors, entries } = build(9);
    const onDemand = chain.createAnchor();
    const a = chain.getAnchors();
    return eq(
      { count: 4, separate: true, keys: ['headHash', 'seq', 'sig', 'ts'], lastSeq: 9 },
      { count: a.length, separate: anchors !== entries && fs.existsSync(anchors), keys: Object.keys(a[0]).sort(), lastSeq: onDemand.seq }
    );
  }],
  ['a forged anchor (bad signature) is detected', () => {
    const { dir, anchors } = build(9);
    const ls = lines(anchors);
    const a = JSON.parse(ls[0]);
    a.headHash = 'f'.repeat(64);
    ls[0] = JSON.stringify(a);
    write(anchors, ls);
    return eq(false, reload(dir).verifyChain().valid);
  }],
  ['required wording is present and the old over-claims are gone', () => {
    const wording =
      /hash-chained and keyed; detects edits, deletions and reordering; an attacker with both the key and the files can still forge; external anchoring is the production fix/i.test(AUDIT_INTEGRITY_NOTE) &&
      /local witness simulation; production would use an external transparency log or RFC 3161 timestamping/i.test(AUDIT_ANCHOR_NOTE);
    const f = path.resolve(process.cwd(), 'README.md');
    const readmeClean = !fs.existsSync(f) || !/without trusting local storage|immutable|undetectable without/i.test(fs.readFileSync(f, 'utf8'));
    return eq({ wording: true, readmeClean: true }, { wording, readmeClean });
  }],
  ['in-memory chains (no AUDIT_DIR) work and still detect edits', () => {
    const c = new AuditHashChain({ key: KEY, quiet: true });
    c.appendEntry({ type: 'POLICY_DECISION', sessionId: 'a', data: { x: 1 } });
    c.appendEntry({ type: 'POLICY_DECISION', sessionId: 'b', data: { x: 2 } });
    const ok = c.verifyChain().valid;
    c.tamperEntry(1, { x: 99 });
    return eq([true, false], [ok, c.verifyChain().valid]);
  }],
]);
