/* dojo-shared core — time.js
 * 有理数・拍子・小節。純粋な計算だけ。
 *
 * データの形(review 4.2、D13)
 *   Dur / Pos  有理数 [分子, 分母]。単位は4分音符 = 1(例 [1, 3] は3連8分)
 *   Meter      { beats, beatType }(例 6/8 は { beats: 6, beatType: 8 })
 *   拍子の変化 [ { from: Pos, beats, beatType }, … ](Score の meter。変化は小節の頭で起きる)
 * 読み込み順: pitch.js → time.js → key.js
 */
(function (root, factory) {
  const ns = factory();
  if (typeof module === 'object' && module.exports) module.exports = ns;
  else root.DojoCore = Object.assign(root.DojoCore || {}, ns);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const version = '0.5.0';

  /* ---------- 有理数 ---------- */
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }

  // 約分し、分母を正にした [n, d] を返す。整数でない・分母が 0・安全な整数を超える場合は例外
  function frac(n, d) {
    if (d === undefined) d = 1;
    if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) throw new TypeError(`有理数の分子・分母が整数でない: ${n}/${d}`);
    if (d === 0) throw new RangeError('有理数の分母が 0');
    if (n === 0) return [0, 1];
    const g = gcd(n, d), s = d < 0 ? -1 : 1;
    return [s * n / g, s * d / g];
  }
  // [n, d] か整数を受け取り、約分した [n, d] にする
  function toFrac(x) {
    if (Number.isInteger(x)) return frac(x, 1);
    if (Array.isArray(x) && x.length === 2) return frac(x[0], x[1]);
    throw new TypeError(`有理数として読めない: ${JSON.stringify(x)}`);
  }
  function isFrac(x) {
    return Array.isArray(x) && x.length === 2 && Number.isSafeInteger(x[0]) && Number.isSafeInteger(x[1]) && x[1] !== 0;
  }

  function add(a, b) { a = toFrac(a); b = toFrac(b); return frac(a[0] * b[1] + b[0] * a[1], a[1] * b[1]); }
  function sub(a, b) { a = toFrac(a); b = toFrac(b); return frac(a[0] * b[1] - b[0] * a[1], a[1] * b[1]); }
  function mul(a, b) { a = toFrac(a); b = toFrac(b); return frac(a[0] * b[0], a[1] * b[1]); }
  function div(a, b) {
    a = toFrac(a); b = toFrac(b);
    if (b[0] === 0) throw new RangeError('0 で割った');
    return frac(a[0] * b[1], a[1] * b[0]);
  }
  // a < b なら −1、等しければ 0、a > b なら 1
  function cmp(a, b) { a = toFrac(a); b = toFrac(b); return Math.sign(a[0] * b[1] - b[0] * a[1]); }
  function eq(a, b) { return cmp(a, b) === 0; }
  function toNumber(a) { a = toFrac(a); return a[0] / a[1]; }
  // 小さい方へ切り捨てた整数
  function floorFrac(a) { a = toFrac(a); return Math.floor(a[0] / a[1]); }

  /* ---------- 拍子 ---------- */
  const BEAT_TYPES = [1, 2, 4, 8, 16, 32, 64];
  function meter(m) {
    const beats = m && m.beats, beatType = m && m.beatType;
    if (!Number.isInteger(beats) || beats < 1) throw new RangeError(`拍子の拍数が正の整数でない: ${beats}`);
    if (!BEAT_TYPES.includes(beatType)) throw new RangeError(`拍子の単位が2のべき乗でない: ${beatType}`);
    return { beats, beatType };
  }
  // 1小節の長さ(4分音符 = 1)。3/4 → [3, 1]、6/8 → [3, 1]
  function barLength(m) { m = meter(m); return frac(4 * m.beats, m.beatType); }

  // Meter 1つか、拍子の変化の列を、from の昇順の列にそろえる
  function segmentsOf(m) {
    if (!Array.isArray(m)) return [{ from: [0, 1], meter: meter(m) }];
    if (m.length === 0) throw new RangeError('拍子の変化の列が空');
    const segs = m.map((x) => ({ from: toFrac(x.from), meter: meter(x) })).sort((a, b) => cmp(a.from, b.from));
    if (!eq(segs[0].from, 0)) throw new RangeError('拍子の変化の列が 0 から始まっていない');
    return segs;
  }

  /* 位置 t(4分音符 = 1)が何小節目の、小節の頭からどれだけの所か。
   *   bar   0 から数えた小節の番号
   *   pos   小節の頭からの長さ(4分音符 = 1)
   *   beat  小節の頭からの拍(拍子の単位の音符 = 1。6/8 なら8分音符 = 1。0 から数える)
   *   meter その位置の拍子
   * 拍子の変化が小節の途中にあれば例外 */
  function barPosition(t, m) {
    t = toFrac(t);
    if (cmp(t, 0) < 0) throw new RangeError(`位置が負: ${JSON.stringify(t)}`);
    const segs = segmentsOf(m);
    let bar = 0;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i], len = barLength(s.meter), next = segs[i + 1];
      if (next) {
        const span = sub(next.from, s.from), bars = div(span, len);
        if (bars[1] !== 1) throw new RangeError(`拍子の変化が小節の途中にある: ${JSON.stringify(next.from)}`);
        if (cmp(t, next.from) >= 0) { bar += bars[0]; continue; }
      }
      const rel = sub(t, s.from), k = floorFrac(div(rel, len));
      const pos = sub(rel, mul(len, k));
      return { bar: bar + k, pos, beat: mul(pos, frac(s.meter.beatType, 4)), meter: s.meter };
    }
    throw new Error('到達しない');
  }
  function barOf(t, m) { return barPosition(t, m).bar; }
  function beatOf(t, m) { return barPosition(t, m).beat; }

  // 小節の番号(0 から)→ その小節の頭の位置
  function barStart(bar, m) {
    if (!Number.isInteger(bar) || bar < 0) throw new RangeError(`小節の番号が 0 以上の整数でない: ${bar}`);
    const segs = segmentsOf(m);
    let first = 0;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i], len = barLength(s.meter), next = segs[i + 1];
      const bars = next ? div(sub(next.from, s.from), len) : null;
      if (bars && bars[1] !== 1) throw new RangeError(`拍子の変化が小節の途中にある: ${JSON.stringify(next.from)}`);
      if (!bars || bar < first + bars[0]) return add(s.from, mul(len, bar - first));
      first += bars[0];
    }
    throw new Error('到達しない');
  }

  return {
    version,
    frac, toFrac, isFrac, add, sub, mul, div, cmp, eq, toNumber, floorFrac,
    meter, barLength, barPosition, barOf, beatOf, barStart,
  };
});
