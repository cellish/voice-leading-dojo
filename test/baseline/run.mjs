// 記録した解答を check() にかけて、結果を取り出す（生成スクリプトとテストで共有する）
import { createRequire } from 'node:module';

// 計算部 js/theory.js を直接読む（画面・vm は使わない）
const VLT = createRequire(import.meta.url)('../../js/theory.js');

export const CONFIGS = ['default', 'allError'];
const plain = (x) => JSON.parse(JSON.stringify(x));

export const newApp = () => VLT;

// 'F♯4' のような文字列 → {l,a,o}。null はそのまま
export const toNotes = (vl, ans) => ans.map(row => row.map(s => (s == null ? null : vl.parseNote(s))));
export const toStrings = (vl, ans) => plain(ans.map(row => row.map(n => (n == null ? null : vl.nName(n)))));

// 設定（既定、または全部 error）
export function makeCfg(vl, cfgName) {
    return {
        sev: Object.fromEntries(vl.RULES.map(r => [r.id, cfgName === 'allError' ? 'error' : r.sev])),
        auto: true, sound: true, german: false, plus4: true, plus6: false
    };
}

// check() の結果を、記録する形（規則・重さ・場所など）にそろえる。
// 「全部 error」は、規則・重さ・場所だけを記録する（文言は既定の設定と同じなので省く）
export function summarize(res, cfgName) {
    const full = cfgName !== 'allError';
    return {
        incomplete: res.incomplete,
        issues: res.issues.map(i => (full ? { rule: i.rule, sev: i.sev, cells: i.cells, where: i.where, msg: i.msg } : { rule: i.rule, sev: i.sev, cells: i.cells }))
    };
}

// 1つの解答の check() の結果
export function evaluate(vl, c, cfgName) {
    const cfg = makeCfg(vl, cfgName);
    const ex = vl.parseExercise(c.text, cfg);
    return summarize(plain(vl.check(ex, toNotes(vl, c.ans), cfg)), cfgName);
}

export function evaluateAll(vl, c) {
    return Object.fromEntries(CONFIGS.map(name => [name, evaluate(vl, c, name)]));
}
