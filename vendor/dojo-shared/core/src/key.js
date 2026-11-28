/* dojo-shared core — key.js
 * 調・音階・調号。純粋な計算だけ。pitch.js と time.js を使う。
 *
 * データの形(review 4.2、D13・D16)
 *   Key  { tonic: PitchClass, mode: 'major' | 'minor' }
 *   調の変化 [ { from: Pos, key: Key }, … ](Score の keys)
 * 調は書かれたまま扱う(D16 #9)。短音階のどの形を使うかは呼ぶ側(ruleset の minorForm)が決める。
 * 読み込み順: pitch.js → time.js → key.js
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const deps = isNode
    ? Object.assign({}, require('./pitch.js'), require('./time.js'))
    : root.DojoCore;
  if (!deps || !deps.parsePitchClass || !deps.cmp) throw new Error('key.js は pitch.js と time.js の後に読み込む');
  const ns = factory(deps);
  if (isNode) module.exports = ns;
  else root.DojoCore = Object.assign(root.DojoCore || {}, ns);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
  'use strict';

  const version = '0.2.0';
  const MODES = ['major', 'minor'];
  const FORMS = ['natural', 'harmonic', 'melodic'];

  /* ---------- 読む ---------- */
  // "C"・"Cmaj"・"C major"・"Cm"・"Cmin"・"D minor"・"F#m"・"B♭ major" など。
  // 主音の文字の大小は区別しない。モードを書かなければ長調
  const KEY_RE = /^(\S+?)\s*(?:([Mm]ajor|[Mm]aj|M)|([Mm]inor|[Mm]in|m))?$/u;
  function parseKey(str) {
    const m = typeof str === 'string' && str.trim().match(KEY_RE);
    if (!m) throw new SyntaxError(`調として読めない: ${JSON.stringify(str)}`);
    let tonic;
    try { tonic = C.parsePitchClass(m[1]); }
    catch (e) { throw new SyntaxError(`調として読めない: ${JSON.stringify(str)}`); }
    const mode = m[3] ? 'minor' : 'major';
    return { tonic, mode };
  }

  function checkKey(key) {
    if (!key || !C.isPitchClass(key.tonic) || !MODES.includes(key.mode)) throw new TypeError(`調の形でない: ${JSON.stringify(key)}`);
    return key;
  }

  // "C major"・"F# minor"(style は pitch.js の formatPitchClass と同じ)。
  // style 'ja' は「変ロ長調」・「嬰ヘ短調」
  function formatKey(key, opts) {
    checkKey(key);
    if (opts && opts.style === 'ja') return C.formatPitchClass(key.tonic, opts) + (key.mode === 'minor' ? '短調' : '長調');
    return `${C.formatPitchClass(key.tonic, opts)} ${key.mode}`;
  }

  /* ---------- 調号 ---------- */
  /* fifths  シャープの数(正)/ フラットの数(負)。MusicXML の <fifths> と同じ
   * alters  文字番号(C=0 … B=6)ごとの変化。例 D major → [1, 0, 0, 1, 0, 0, 0]
   * 理論上の調(G# major など)では |fifths| > 7 になり、alters に ±2 が入る */
  function keySignature(key) {
    checkKey(key);
    const fifths = C.fifthsOf(key.tonic) - (key.mode === 'minor' ? 3 : 0);
    const NAT = [0, 2, 4, -1, 1, 3, 5];
    const alters = NAT.map((p) => Math.floor((fifths + 5 - p) / 7));
    return { fifths, alters };
  }

  /* ---------- 音階 ---------- */
  /* 主音から7音の PitchClass。
   * 長調は form を見ない。短調は form で natural(既定)/ harmonic(第7音を半音上げる)/
   * melodic(上行形。第6・7音を半音上げる。下行形は natural) */
  function scaleOf(key, form) {
    checkKey(key);
    if (form === undefined) form = 'natural';
    if (!FORMS.includes(form)) throw new RangeError(`短音階の形が不明: ${form}`);
    const { alters } = keySignature(key);
    const scale = [];
    for (let i = 0; i < 7; i++) {
      const letter = (key.tonic.letter + i) % 7;
      scale.push({ letter, alter: alters[letter] });
    }
    if (key.mode === 'minor') {
      if (form === 'harmonic' || form === 'melodic') scale[6] = raise(scale[6]);
      if (form === 'melodic') scale[5] = raise(scale[5]);
    }
    return scale;
  }
  function raise(p) {
    if (p.alter >= 2) throw new RangeError('変化記号が範囲外(+3 以上)になる調');
    return { letter: p.letter, alter: p.alter + 1 };
  }

  // 導音(主音の半音下)。短調は和声短音階の第7音
  function leadingTone(key) { return scaleOf(key, 'harmonic')[6]; }

  /* 音(Pitch か PitchClass)の、調の中の度数。
   *   degree  1〜7(文字だけで決まる)
   *   alter   その調の音階(form。既定 natural)の音からの変化。0 なら音階の音
   * 例 A minor で G#: { degree: 7, alter: 1 }(form 'harmonic' なら alter 0) */
  function degreeOf(p, key, form) {
    const scale = scaleOf(key, form);
    const letter = Number.isInteger(p.step) ? ((p.step % 7) + 7) % 7 : p.letter;
    const i = (letter - key.tonic.letter + 7) % 7;
    return { degree: i + 1, alter: p.alter - scale[i].alter };
  }

  // 調の移調(綴りを保つ。iv は pitch.js の transpose と同じ)
  function transposeKey(key, iv) {
    checkKey(key);
    return { tonic: C.transpose(key.tonic, iv), mode: key.mode };
  }

  /* 位置 t の調。score.keys(または調の変化の列そのもの)から、from が t 以下で最も後のもの。
   * 無ければ null */
  function keyAt(score, t) {
    const list = Array.isArray(score) ? score : score && score.keys;
    if (!Array.isArray(list)) throw new TypeError('score.keys が配列でない');
    let best = null;
    for (const k of list) {
      if (C.cmp(k.from, t) <= 0 && (!best || C.cmp(k.from, best.from) >= 0)) best = k;
    }
    return best ? best.key : null;
  }

  return {
    version,
    parseKey, formatKey, keySignature, scaleOf, leadingTone, degreeOf, transposeKey, keyAt,
  };
});
