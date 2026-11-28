// 実行：node --test
// 画面側（index.html が st を渡して check() を呼ぶ形）が、計算部を直接呼んだ結果と同じ判定を返すことを確かめる。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadApp } from './harness.mjs';
import { newApp, makeCfg, summarize, toNotes, CONFIGS } from './baseline/run.mjs';

const baseline = JSON.parse(readFileSync(new URL('./baseline/examples.json', import.meta.url), 'utf8'));
const plain = (x) => JSON.parse(JSON.stringify(x));
const theory = newApp();

test('アプリが起動し、例題6つと17規則を読める', () => {
    const { vl } = loadApp();
    assert.equal(vl.EXAMPLES.length, 6);
    assert.equal(vl.RULES.length, 17);
    assert.equal(vl.st.ex.bass.length, 8);
});

test('保存データ（harmony-figured-bass-drill-v1）をそのまま読める', () => {
    // 保存される sev は全規則ぶん（load() は sev を保存の内容で置き換える。保存に無い規則は未定義になる）
    const sev = Object.fromEntries(newApp().RULES.map(r => [r.id, r.sev]));
    sev.parallel = 'off';
    const saved = { cfg: { german: true, plus4: false, sev }, answers: { ex1: [[{ l: 4, a: 0, o: 4 }, null, null]] }, custom: '', exId: 'ex2', tuning: 'ji', tempo: 2 };
    const { vl } = loadApp({ storage: { 'harmony-figured-bass-drill-v1': JSON.stringify(saved) } });
    assert.equal(vl.st.exId, 'ex2');
    assert.equal(vl.st.tuning, 'ji');
    assert.equal(vl.st.cfg.german, true);
    assert.equal(vl.st.cfg.sev.parallel, 'off');
    assert.equal(vl.st.cfg.sev.crossing, 'error');
    assert.equal(vl.st.cfg.plus4, false);
});

test('画面側の check() が、記録した判定結果と同じ（既定の設定と「全部 error」）', () => {
    const { vl } = loadApp();
    for (const c of baseline.cases) for (const name of CONFIGS) {
        const cfg = makeCfg(theory, name);
        Object.assign(vl.st.cfg, { german: false, plus4: true, plus6: false });
        vl.RULES.forEach(r => { vl.st.cfg.sev[r.id] = cfg.sev[r.id]; });
        vl.st.ex = vl.parseExercise(c.text);
        vl.st.ans = toNotes(vl, c.ans);
        assert.deepEqual(summarize(plain(vl.check()), name), c.results[name], `${c.id} / ${name}`);
    }
});

test('ドイツ式の音名の設定が、判定の文言に反映される', () => {
    const { vl } = loadApp();
    vl.st.cfg.german = true;
    vl.st.ex = vl.parseExercise('C  C3 D3');
    vl.st.ans = toNotes(vl, [['B4', 'G4', 'D4'], ['F5', 'E4', 'C4']]);
    const msgs = plain(vl.check()).issues.map(i => i.msg).join('\n');
    assert.match(msgs, /H4/, 'B4 は H4 と出る');
});
