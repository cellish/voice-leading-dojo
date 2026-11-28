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

// 画面の操作（js/ を分けたあとも、ボタンの処理から他のファイルの関数を呼べる）
test('ボタンの操作で音が動き、判定に反映される（音の再生は AudioContext が無いので何も鳴らない）', () => {
    const { vl, elements } = loadApp();
    const click = (id) => elements[id].listeners.click();
    vl.st.sel = { k: 3, v: 0 };
    vl.st.ans[3][0] = vl.parseNote('G4');
    click('up');
    assert.equal(vl.nName(vl.st.ans[3][0]), 'A4');
    click('down'); click('down');
    assert.equal(vl.nName(vl.st.ans[3][0]), 'F4');
    click('accS');
    assert.equal(vl.nName(vl.st.ans[3][0]), 'F♯4');
    click('clr');
    assert.equal(vl.st.ans[3][0], null);
    click('tJi');
    assert.equal(vl.st.tuning, 'ji');
    click('playAll'); click('stop'); // 再生・停止の処理が例外を出さない
});

test('譜表のクリックで、押した高さの音が入る', () => {
    const { vl, elements } = loadApp();
    vl.st.sel = { k: 4, v: 1 };
    const g = vl.geo; // 譜表の座標（描画で決まる）。4番目の和音の列の中央を押す
    elements.staff.listeners.click({ clientX: (g.head + 4 * 62 + 31) * 800 / g.W, clientY: 100 });
    assert.ok(vl.st.ans[4][1], 'アルトに音が入る');
    assert.ok(plain(vl.check()).incomplete >= 0);
});
