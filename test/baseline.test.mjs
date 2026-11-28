// 実行：node --test
// check() の判定結果が、記録（test/baseline/examples.json）と同じであることを確かめる。
// 判定を意図して変えたときだけ、node test/baseline/generate.mjs で記録を作り直す。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newApp, evaluateAll, toNotes, toStrings, CONFIGS } from './baseline/run.mjs';
import { buildCases } from './baseline/generate.mjs';

const baseline = JSON.parse(readFileSync(new URL('./baseline/examples.json', import.meta.url), 'utf8'));
const vl = newApp();

test('記録した規則の id と順番が、RULES と同じ', () => {
    assert.deepEqual(baseline.rules, [...vl.RULES].map(r => r.id));
});

test('例題6つの課題文が、記録した解答の課題文と同じ', () => {
    for (const e of vl.EXAMPLES) {
        const cs = baseline.cases.filter(c => c.exercise === e.id);
        assert.ok(cs.length > 0, `${e.id} の解答がない`);
        assert.ok(cs.every(c => c.text === e.text), `${e.id} の課題文が記録と違う`);
    }
});

test('全17規則が、既定の設定で少なくとも1回は出る', () => {
    const count = Object.fromEntries([...vl.RULES].map(r => [r.id, 0]));
    for (const c of baseline.cases) for (const i of c.results.default.issues) count[i.rule]++;
    const missing = Object.entries(count).filter(([, n]) => n === 0).map(([id]) => id);
    assert.deepEqual(missing, [], `出ない規則: ${missing.join(', ')}`);
    assert.deepEqual(count, baseline.coverage);
});

test('解答の書き方（F♯4 など）が、読み込んで書き戻しても変わらない', () => {
    for (const c of baseline.cases) assert.deepEqual(toStrings(vl, toNotes(vl, c.ans)), c.ans, c.id);
});

test('生成スクリプトが、記録と同じ解答を作る（乱数の種が固定されている）', () => {
    const gen = buildCases();
    assert.equal(gen.length, baseline.cases.length);
    gen.forEach((g, i) => { assert.equal(g.id, baseline.cases[i].id); assert.deepEqual(g.ans, baseline.cases[i].ans, g.id); });
});

for (const c of baseline.cases) {
    test(`判定結果が記録と同じ: ${c.id}`, () => {
        assert.deepEqual(Object.keys(c.results), CONFIGS);
        assert.deepEqual(evaluateAll(vl, c), c.results);
    });
}

test('「全部 error」の設定では、重さが error 以外の判定が出ない', () => {
    for (const c of baseline.cases) for (const i of c.results.allError.issues) assert.equal(i.sev, 'error', c.id);
});

test('途中まで未入力の解答では、未入力の和音の数が記録どおりに数えられる', () => {
    const c = baseline.cases.find(x => x.id === 'ex1/half');
    assert.ok(c.results.default.incomplete > 0);
    assert.equal(c.results.default.incomplete, c.ans.filter(row => row.some(n => n == null)).length);
});
