// 記録した解答を check() にかけて、結果を取り出す（生成スクリプトとテストで共有する）
import { loadApp } from '../harness.mjs';

export const CONFIGS = ['default', 'allError'];
const plain = (x) => JSON.parse(JSON.stringify(x));

export function newApp() { return loadApp().vl; }

// 'F♯4' のような文字列 → {l,a,o}。null はそのまま
export const toNotes = (vl, ans) => ans.map(row => row.map(s => (s == null ? null : vl.parseNote(s))));
export const toStrings = (vl, ans) => plain(ans.map(row => row.map(n => (n == null ? null : vl.nName(n)))));

// 設定を整えて、1つの解答の check() の結果を返す。st は呼ぶたびに既定へ戻す
export function evaluate(vl, c, cfgName) {
    const st = vl.st;
    Object.assign(st.cfg, { auto: true, sound: true, german: false, plus4: true, plus6: false });
    vl.RULES.forEach(r => { st.cfg.sev[r.id] = cfgName === 'allError' ? 'error' : r.sev; });
    st.ex = vl.parseExercise(c.text);
    st.ans = toNotes(vl, c.ans);
    const res = plain(vl.check());
    // 「全部 error」は、規則・重さ・場所だけを記録する（文言は既定の設定と同じなので省く）
    const full = cfgName !== 'allError';
    return {
        incomplete: res.incomplete,
        issues: res.issues.map(i => (full ? { rule: i.rule, sev: i.sev, cells: i.cells, where: i.where, msg: i.msg } : { rule: i.rule, sev: i.sev, cells: i.cells }))
    };
}

export function evaluateAll(vl, c) {
    return Object.fromEntries(CONFIGS.map(name => [name, evaluate(vl, c, name)]));
}
