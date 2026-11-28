/* dojo-shared core — rules/motion.js
 * 声部対の進行の規則: 平行(parallel)・反行(contrary)・隠伏(hidden)の5度・8度、交差(crossing)。
 * GR(gradus-dojo js/engine.js の analyze)と VL(voice-leading-dojo js/theory.js の check)の判定部から移した。
 * GR と VL の違いはパラメータで残す(D14。dojo-core-prep.md 5.4)。
 * 読み込み順: pitch.js → time.js → key.js → rules.js → rules/motion.js
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const deps = isNode ? Object.assign({}, require('../pitch.js'), require('../rules.js')) : root.DojoCore;
  if (!deps || !deps.interval || !deps.registerRule) throw new Error('rules/motion.js は pitch.js と rules.js の後に読み込む');
  const ns = factory(deps);
  if (isNode) module.exports = ns;
  else root.DojoCore = Object.assign(root.DojoCore || {}, ns);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
  'use strict';

  const version = '0.4.1';

  /* 2音の完全協和の種類: 'fifth'(完全5度と複音程)| 'octave'(完全8度と複音程)| 'unison'(完全1度)| null。
   * 綴りで決める(増4度と減5度、減8度などを区別する)。声部が交差していても同じに数える */
  function perfectKind(x, y) {
    let lo = x, hi = y;
    if (hi.step < lo.step) { lo = y; hi = x; }
    const iv = C.interval(lo, hi);
    if (!iv.perfect) return null;
    return iv.dn === 4 ? 'fifth' : (iv.d === 0 ? 'unison' : 'octave');
  }
  const sameFamily = (a, b) => !!a && !!b && (a === 'fifth') === (b === 'fifth'); // 1度と8度は同じ仲間

  /* 隣り合う2列の、声部の組ごとの進行。完全協和へ入るものだけを返す
   * params.pairs        'all'(既定)| 'outer' | 'adjacent'
   * params.skipCrossed  true なら、後の列で交差している組を除く(GR) */
  // 列 c の声部 i・j の perfectKind。平行・反行・隠伏が同じ列を見るので、1回の judge の中で使い回す
  function kindAt(view, ctx, c, i, j) {
    const cache = ctx.memo('motion.perfectKind', () => []), n = view.voices.length, k = (c * n + i) * n + j;
    let v = cache[k];
    if (v === undefined) { const N = view.columns[c].notes; v = cache[k] = perfectKind(N[i], N[j]) || 0; }
    return v || null;
  }

  /* 完全協和へ入る進行の一覧 [{ c, i, j, A, B, kb, ka, m }]。平行・反行・隠伏が同じ一覧を見るので、
   * 1回の judge の中では pairs・skipCrossed ごとに1回だけ作る */
  function arrivalList(view, params, ctx) {
    const kind = params.pairs || 'all', skip = !!params.skipCrossed;
    return ctx.memo('motion.arrivals:' + kind + ':' + skip, () => {
      const pairs = ctx.pairs(kind), out = [];
      for (let c = 1; c < view.columns.length; c++) {
        const A = view.columns[c - 1].notes, B = view.columns[c].notes;
        for (const [i, j] of pairs) {
          if (!A[i] || !A[j] || !B[i] || !B[j]) continue;
          if (skip && B[i].step < B[j].step) continue;
          const kb = kindAt(view, ctx, c, i, j);
          if (!kb) continue;
          out.push({ c, i, j, A, B, kb, ka: kindAt(view, ctx, c - 1, i, j), m: C.motion(A[i], B[i], A[j], B[j]) });
        }
      }
      return out;
    });
  }
  function arrivals(view, params, ctx, visit) { for (const x of arrivalList(view, params, ctx)) visit(x); }

  const fourRefs = (view, c, i, j) => [
    { col: c - 1, voice: view.voices[i].id }, { col: c - 1, voice: view.voices[j].id },
    { col: c, voice: view.voices[i].id }, { col: c, voice: view.voices[j].id },
  ];
  const pairVars = (ctx, i, j) => ({ upper: ctx.voice(i).name, lower: ctx.voice(j).name });

  // 前後とも同じ仲間の完全協和(5度→5度、1度・8度→1度・8度)で、両声が同じ方向(parallel)/反対方向(contrary)
  function consecutive(want) {
    return function (view, params, ctx) {
      const out = [];
      arrivals(view, params, ctx, ({ c, i, j, kb, ka, m }) => {
        if (m === want && sameFamily(ka, kb)) out.push({ refs: fourRefs(view, c, i, j), case: kb, vars: pairVars(ctx, i, j) });
      });
      return out;
    };
  }
  const parallelPerfect = consecutive('similar');
  const contraryPerfect = consecutive('contrary');

  /* 隠伏(並達)5度・8度: 同じ方向の動きで完全協和に入る
   * params.prev           'notSameKind'(既定。前が同じ仲間の完全協和でなければ当てる。GR)| 'notPerfect'(前が完全協和でないときだけ。VL)
   * params.minUpperMove   上の声の動きの半音数の下限(既定 0。VL は 3 = ソプラノの跳躍)
   * params.refs           'both'(既定。前後の列の4音)| 'arrival'(後の列の2音だけ。VL) */
  function hiddenPerfect(view, params, ctx) {
    const prev = params.prev || 'notSameKind';
    if (prev !== 'notSameKind' && prev !== 'notPerfect') throw new RangeError(`hidden の prev が不明: ${prev}`);
    const minUp = params.minUpperMove || 0;
    const out = [];
    arrivals(view, params, ctx, ({ c, i, j, A, B, kb, ka, m }) => {
      if (m !== 'similar') return;
      if (prev === 'notSameKind' ? sameFamily(ka, kb) : ka) return;
      if (Math.abs(C.toMidi(B[i]) - C.toMidi(A[i])) < minUp) return;
      const refs = params.refs === 'arrival'
        ? [{ col: c, voice: view.voices[i].id }, { col: c, voice: view.voices[j].id }]
        : fourRefs(view, c, i, j);
      out.push({ refs, case: kb, vars: pairVars(ctx, i, j) });
    });
    return out;
  }

  /* 声部の交差: 上の声部が下の声部より低い。同じ高さは交差にしない
   * params.pairs            'adjacent'(既定)| 'all' | 'outer'
   * params.compare          'step'(綴りの度数で比べる。GR)| 'midi'(半音で比べる。VL。既定)
   * params.requireComplete  true なら、列の全声部がそろったときだけ見る(VL)
   * case: 上の声部が answer なら 'upper'、そうでなければ 'lower'(誰が回り込んだかを文言で言い分けるため) */
  function crossing(view, params, ctx) {
    const pairs = ctx.pairs(params.pairs || 'adjacent');
    const byStep = params.compare === 'step';
    if (params.compare !== undefined && params.compare !== 'step' && params.compare !== 'midi') throw new RangeError(`crossing の compare が不明: ${params.compare}`);
    const out = [];
    view.columns.forEach((col, c) => {
      const N = col.notes;
      if (params.requireComplete && N.some((x) => !x)) return;
      for (const [i, j] of pairs) {
        if (!N[i] || !N[j]) continue;
        const crossed = byStep ? N[i].step < N[j].step : C.toMidi(N[i]) < C.toMidi(N[j]);
        if (!crossed) continue;
        out.push({
          refs: [{ col: c, voice: view.voices[i].id }, { col: c, voice: view.voices[j].id }],
          case: view.voices[i].role === 'answer' ? 'upper' : 'lower', vars: pairVars(ctx, i, j),
        });
      }
    });
    return out;
  }

  C.registerRule('parallel', parallelPerfect);
  C.registerRule('contrary', contraryPerfect);
  C.registerRule('hidden', hiddenPerfect);
  C.registerRule('crossing', crossing);

  return { version, perfectKind, parallelPerfect, contraryPerfect, hiddenPerfect, crossing };
});
