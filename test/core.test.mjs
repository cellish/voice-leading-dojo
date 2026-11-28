// 実行：node --test
// 声部対の規則(range・crossing・parallel・contrary・hidden・leap)を書法コアの judge(ruleset tonal-4v)で判定する部分。
// 記録(examples.json)に出ない場合を確かめる: ドイツ式の音名、重さ「オフ」と未設定、RANGE と ruleset の音域の一致。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const vl = require('../js/theory.js');
const ruleset = require('../vendor/dojo-shared/core/data/rulesets/tonal-4v.js');

const cfgOf = (over = {}) => Object.assign({
    sev: Object.fromEntries(vl.RULES.map(r => [r.id, r.sev])), german: false, plus4: true, plus6: false,
}, over);
const notes = rows => rows.map(r => r.map(s => (s == null ? null : vl.parseNote(s))));

test('S・A・T の音域(RANGE)は ruleset tonal-4v の range と同じ', () => {
    const r = ruleset.rules.find(e => e.rule === 'range').params.ranges;
    assert.deepEqual(vl.RANGE.slice(0, 3), [r.S, r.A, r.T]);
});

test('ruleset tonal-4v の規則の並び・重さ・名前は RULES と同じ', () => {
    assert.deepEqual(ruleset.rules.map(e => [e.rule, e.level, e.name.ja]), vl.RULES.map(r => [r.id, r.sev, r.name]));
});

test('音域外の音名は、ドイツ式の設定に従う', () => {
    const ex = vl.parseExercise('C  C3', {});
    const ans = notes([['C5', 'G4', 'Bb2']]);
    const msg = (german) => vl.check(ex, ans, cfgOf({ german })).issues.filter(i => i.rule === 'range').map(i => i.msg);
    assert.deepEqual(msg(false), ['テノールの B♭2 は音域外です']);
    assert.deepEqual(msg(true), ['テノールの B2 は音域外です']);
});

test('重さが「オフ」または未設定の規則は出さない(コアに移した規則も同じ)', () => {
    const ex = vl.parseExercise('C  C3 D3', {});
    const ans = notes([['C5', 'E4', 'G3'], ['D5', 'F4', 'A3']]); // ソプラノとバスの連続8度、テノールとバスの連続5度
    const rules = (cfg) => vl.check(ex, ans, cfg).issues.filter(i => i.rule === 'parallel').length;
    assert.equal(rules(cfgOf()), 2);
    const off = cfgOf(); off.sev.parallel = 'off';
    assert.equal(rules(off), 0);
    const missing = cfgOf(); delete missing.sev.parallel;
    assert.equal(rules(missing), 0);
    const warn = cfgOf(); warn.sev.parallel = 'warn';
    assert.ok(vl.check(ex, ans, warn).issues.filter(i => i.rule === 'parallel').every(i => i.sev === 'warn'));
});

test('判定の入力(coreView): 列 = 和音、声部は S・A・T・B、未入力は null', () => {
    const ex = vl.parseExercise('C  C3 G2', {});
    const v = vl.coreView(ex, notes([['E4', null, 'G3'], [null, null, null]]));
    assert.deepEqual(v.voices.map(x => [x.id, x.role]), [['S', 'answer'], ['A', 'answer'], ['T', 'answer'], ['B', 'given']]);
    assert.deepEqual(v.columns[0].notes, [{ step: 30, alter: 0 }, null, { step: 25, alter: 0 }, { step: 21, alter: 0 }]);
    assert.deepEqual(v.columns[1].notes.slice(0, 3), [null, null, null]);
});
