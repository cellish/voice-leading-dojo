/* dojo-shared core — rules/melodic.js
 * 声部ごとの規則: 大きな跳躍(leap)、旋律の音域の幅(ambitus。旧 GR の range)、声部の音域(range。VL)。
 * GR(gradus-dojo js/engine.js の analyze)と VL(voice-leading-dojo js/theory.js の check)の判定部から移した。
 * 読み込み順: pitch.js → time.js → key.js → rules.js → rules/melodic.js
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const deps = isNode ? Object.assign({}, require('../pitch.js'), require('../rules.js')) : root.DojoCore;
  if (!deps || !deps.toMidi || !deps.registerRule) throw new Error('rules/melodic.js は pitch.js と rules.js の後に読み込む');
  const ns = factory(deps);
  if (isNode) module.exports = ns;
  else root.DojoCore = Object.assign(root.DojoCore || {}, ns);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
  'use strict';

  const version = '0.4.1';

  /* 大きな跳躍: 声部の、打鍵する隣り合う2音(途中が未入力なら見ない)の跳躍が
   * 「オクターヴを超える」(case 'over')か「7度」(case 'seventh')
   * params.roles    見る声部の役割(既定 ['answer'])
   * params.measure  オクターヴを超えるかの測り方: 'steps'(度数で9度以上。GR。既定)| 'semitones'(13半音以上。VL)
   * 同じ度数の動き(同音・半音階的な動き)は見ない(別の規則) */
  function melodicLeap(view, params, ctx) {
    const bySemi = params.measure === 'semitones';
    if (params.measure !== undefined && params.measure !== 'steps' && params.measure !== 'semitones') throw new RangeError(`leap の measure が不明: ${params.measure}`);
    const out = [];
    for (const v of ctx.voicesOf(params.roles)) {
      const P = ctx.attacks(v);
      for (let k = 1; k < P.length; k++) {
        const p = view.columns[P[k - 1]].notes[v], q = view.columns[P[k]].notes[v];
        if (!p || !q) continue;
        const ad = Math.abs(q.step - p.step), am = Math.abs(C.toMidi(q) - C.toMidi(p));
        if (ad === 0) continue;
        const over = bySemi ? am > 12 : ad > 7;
        const kase = over ? 'over' : ad === 6 ? 'seventh' : null;
        if (!kase) continue;
        const id = view.voices[v].id;
        out.push({ refs: [{ col: P[k - 1], voice: id }, { col: P[k], voice: id }], case: kase, vars: { voice: ctx.voice(v).name } });
      }
    }
    return out;
  }

  /* 旋律の音域の幅: 声部の打鍵した音の、最高音と最低音の度数の差が maxSteps を超える。
   * refs は最高音と最低音の列(何度でも)。vars.degrees は幅の度数(10度なら 10)
   * params.roles(既定 ['answer'])、params.maxSteps(既定 9 = 10度まで) */
  function ambitus(view, params, ctx) {
    const max = params.maxSteps === undefined ? 9 : params.maxSteps;
    const out = [];
    for (const v of ctx.voicesOf(params.roles)) {
      const filled = ctx.attacks(v).filter((c) => view.columns[c].notes[v]);
      if (filled.length < 2) continue;
      const ss = filled.map((c) => view.columns[c].notes[v].step), mx = Math.max(...ss), mn = Math.min(...ss);
      if (mx - mn <= max) continue;
      const id = view.voices[v].id;
      out.push({
        refs: filled.filter((c, k) => ss[k] === mx || ss[k] === mn).map((c) => ({ col: c, voice: id })),
        vars: { voice: ctx.voice(v).name, degrees: mx - mn + 1 },
      });
    }
    return out;
  }

  /* 声部の音域: 声部の音が、声部ごとの MIDI の範囲 params.ranges[声部id] = [下限, 上限] の外。
   * 打鍵する音ごとに見る。params.roles(既定 ['answer'])の声部はすべて ranges に入れること */
  function voiceRange(view, params, ctx) {
    const ranges = params.ranges || {};
    const out = [];
    for (const v of ctx.voicesOf(params.roles)) {
      const id = view.voices[v].id, r = ranges[id];
      if (!Array.isArray(r) || r.length !== 2) throw new Error(`range: 声部 ${id} の音域が params.ranges に無い`);
      for (const c of ctx.attacks(v)) {
        const p = view.columns[c].notes[v];
        if (!p) continue;
        const m = C.toMidi(p);
        if (m < r[0] || m > r[1]) out.push({ refs: [{ col: c, voice: id }], vars: { voice: ctx.voice(v).name, note: p } });
      }
    }
    return out;
  }

  C.registerRule('leap', melodicLeap);
  C.registerRule('ambitus', ambitus);
  C.registerRule('range', voiceRange);

  return { version, melodicLeap, ambitus, voiceRange };
});
