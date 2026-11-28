/* dojo-shared core — pitch.js
 * 綴りつき音高・音程・移調。純粋な計算だけ(DOM・保存・音に触れない)。
 * ブラウザ・Worker では globalThis.DojoCore に足し、Node では module.exports。
 *
 * データの形(review 4.2、D13)
 *   Pitch      { step, alter }   step = オクターヴ×7 + 文字番号(C=0 … B=6)、C4 = 28。alter は −2〜+2
 *   PitchClass { letter, alter } オクターヴの無い音名(調の主音・コードの根音・ベース)。letter 0=C … 6=B
 * 読み込み順: pitch.js → time.js → key.js
 */
(function (root, factory) {
  const ns = factory();
  if (typeof module === 'object' && module.exports) module.exports = ns;
  else root.DojoCore = Object.assign(root.DojoCore || {}, ns);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const version = '0.2.0';

  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const PC = [0, 2, 4, 5, 7, 9, 11];          // 幹音の半音位置
  const FIFTHS = [0, 2, 4, -1, 1, 3, 5];       // 幹音の5度圏の位置(C=0, G=1, … F=−1)
  const MIN_ALTER = -2, MAX_ALTER = 2;

  /* ---------- 入力の確かめ ---------- */
  const isInt = (x) => Number.isInteger(x);
  const okAlter = (a) => isInt(a) && a >= MIN_ALTER && a <= MAX_ALTER;
  function isPitch(p) { return !!p && isInt(p.step) && okAlter(p.alter); }
  function isPitchClass(p) { return !!p && isInt(p.letter) && p.letter >= 0 && p.letter <= 6 && okAlter(p.alter); }

  // Pitch と PitchClass のどちらからでも文字番号を得る
  const letterOf = (p) => (isInt(p.step) ? ((p.step % 7) + 7) % 7 : p.letter);
  const octaveOf = (p) => Math.floor(p.step / 7);

  /* ---------- 読み書き ---------- */
  // 変化記号: # ♯ / ## x 𝄪 ♯♯ / b ♭ / bb 𝄫 ♭♭
  const ACC = { '': 0, '#': 1, '♯': 1, '##': 2, 'x': 2, '𝄪': 2, '♯♯': 2, 'b': -1, '♭': -1, 'bb': -2, '𝄫': -2, '♭♭': -2 };
  const ACC_RE = '(##|♯♯|bb|♭♭|#|♯|x|𝄪|b|♭|𝄫)?';
  const PITCH_RE = new RegExp(`^([A-Ga-g])${ACC_RE}(-?\\d+)$`, 'u');
  const PC_RE = new RegExp(`^([A-Ga-g])${ACC_RE}$`, 'u');

  function parsePitch(str) {
    const m = typeof str === 'string' && str.trim().match(PITCH_RE);
    if (!m) throw new SyntaxError(`音高として読めない: ${JSON.stringify(str)}`);
    const letter = LETTERS.indexOf(m[1].toUpperCase());
    return { step: Number(m[3]) * 7 + letter, alter: ACC[m[2] || ''] };
  }

  function parsePitchClass(str) {
    const m = typeof str === 'string' && str.trim().match(PC_RE);
    if (!m) throw new SyntaxError(`音名として読めない: ${JSON.stringify(str)}`);
    return { letter: LETTERS.indexOf(m[1].toUpperCase()), alter: ACC[m[2] || ''] };
  }

  const ACC_ASCII = { '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': '##' };
  const ACC_UNICODE = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' };
  // ドイツ式。B♭ = B、B = H。重変化は Ceses・Cisis などの形(A𝄫 は Asas、B𝄫 は Heses)
  const GERMAN = [
    ['Ceses', 'Ces', 'C', 'Cis', 'Cisis'],
    ['Deses', 'Des', 'D', 'Dis', 'Disis'],
    ['Eses', 'Es', 'E', 'Eis', 'Eisis'],
    ['Feses', 'Fes', 'F', 'Fis', 'Fisis'],
    ['Geses', 'Ges', 'G', 'Gis', 'Gisis'],
    ['Asas', 'As', 'A', 'Ais', 'Aisis'],
    ['Heses', 'B', 'H', 'His', 'Hisis'],
  ];

  // 日本式(ハ・ニ・ホ・ヘ・ト・イ・ロ)。変化記号は前に付ける: 嬰ヘ・変ロ・重嬰ハ・重変ロ
  const JA_LETTERS = ['ハ', 'ニ', 'ホ', 'ヘ', 'ト', 'イ', 'ロ'];
  const JA_ACC = { '-2': '重変', '-1': '変', '0': '', '1': '嬰', '2': '重嬰' };

  function nameOfClass(letter, alter, style) {
    if (!okAlter(alter)) throw new RangeError(`alter が範囲外: ${alter}`);
    if (style === 'german') return GERMAN[letter][alter + 2];
    if (style === 'ja') return JA_ACC[alter] + JA_LETTERS[letter];
    if (style === 'unicode') return LETTERS[letter] + ACC_UNICODE[alter];
    if (style === undefined || style === 'ascii') return LETTERS[letter] + ACC_ASCII[alter];
    throw new RangeError(`style が不明: ${style}`);
  }

  // style: 'ascii'(既定。"F#4")/ 'unicode'("F♯4")/ 'german'("Fis4")/ 'ja'("嬰ヘ4"。オクターヴは数字のまま)
  function formatPitch(p, opts) {
    const style = opts && opts.style;
    return nameOfClass(letterOf(p), p.alter, style) + octaveOf(p);
  }
  function formatPitchClass(p, opts) {
    return nameOfClass(letterOf(p), p.alter, opts && opts.style);
  }

  /* ---------- MIDI ---------- */
  // C4 = 60(GR の midi と同じ)
  function toMidi(p) { return 12 * (octaveOf(p) + 1) + PC[letterOf(p)] + p.alter; }

  // 半音の数(0〜11)。Pitch と PitchClass のどちらでもよい
  function pitchClassNumber(p) { return (((PC[letterOf(p)] + p.alter) % 12) + 12) % 12; }

  // 5度圏の位置(C=0, G=1, F=−1, F♯=6, B♭=−2)。綴りの決定と調号に使う
  function fifthsOf(p) { return FIFTHS[letterOf(p)] + 7 * p.alter; }

  /* MIDI 番号 → Pitch。綴りは ctx で決める(優先順)
   *   ctx.tones  PitchClass の配列(例 コードの構成音)。同じ高さの綴りがあればそれ
   *   ctx.key    Key({tonic, mode})。調の中心に5度圏で最も近い綴り。
   *              ちょうど反対側(増4度/減5度の位置)は、長調はフラット側、短調はシャープ側(導音)
   *   ctx.prefer 'sharp'(既定)/ 'flat'。幹音があれば幹音、なければ ♯ か ♭ の1つ
   * 重変化は ctx.tones に入っているときだけ出る */
  function fromMidi(midi, ctx) {
    if (!isInt(midi)) throw new TypeError(`MIDI 番号が整数でない: ${midi}`);
    ctx = ctx || {};
    const cands = [];
    for (let letter = 0; letter < 7; letter++) {
      for (let alter = MIN_ALTER; alter <= MAX_ALTER; alter++) {
        const o = (midi - PC[letter] - alter) / 12 - 1;
        if (isInt(o)) cands.push({ step: o * 7 + letter, alter });
      }
    }
    if (ctx.tones) {
      const hit = cands.find((c) => ctx.tones.some((t) => letterOf(t) === letterOf(c) && t.alter === c.alter));
      if (hit) return hit;
    }
    const single = cands.filter((c) => Math.abs(c.alter) <= 1);
    if (ctx.key) {
      const mode = ctx.key.mode;
      // 調の全音階(長調・自然短音階)は 5度圏で [center−3, center+3]
      const center = fifthsOf(ctx.key.tonic) + (mode === 'minor' ? -1 : 2);
      const dist = (c) => Math.abs(fifthsOf(c) - center);
      const best = Math.min(...single.map(dist));
      const ties = single.filter((c) => dist(c) === best);
      if (ties.length === 1) return ties[0];
      const sharpSide = ties.filter((c) => fifthsOf(c) > center);
      const flatSide = ties.filter((c) => fifthsOf(c) < center);
      return (mode === 'minor' ? sharpSide : flatSide)[0] || ties[0];
    }
    const natural = single.find((c) => c.alter === 0);
    if (natural) return natural;
    const want = ctx.prefer === 'flat' ? -1 : 1;
    return single.find((c) => c.alter === want);
  }

  /* ---------- 比べる ---------- */
  // 異名同音を同じとみなす(オクターヴは見ない)。Pitch と PitchClass のどちらでもよい
  function samePitchClass(a, b) { return !!a && !!b && pitchClassNumber(a) === pitchClassNumber(b); }
  // 綴りが同じ(文字と変化記号。オクターヴは見ない。VL の same と同じ)
  function sameSpelling(a, b) { return !!a && !!b && letterOf(a) === letterOf(b) && a.alter === b.alter; }

  /* ---------- 音程 ---------- */
  /* GR(gradus-dojo js/engine.js)の interval から移した。入出力と結果は同じ。
   * lo の step が hi 以下であること(GR と同じ前提。逆だと d が負になる)
   *   d     度数−1(0=1度、4=5度、9=10度)
   *   dn    オクターヴを除いた度数−1(0〜6)
   *   q     'P' | 'M' | 'm' | 'A' | 'd'(重増・重減も 'A'・'d')
   *   semi  半音の数
   *   perfect 完全1・5・8度(複音程を含む)
   *   cons  協和(完全1・5度と長短3・6度。完全4度は不協和) */
  function interval(lo, hi) {
    const d = hi.step - lo.step, semi = toMidi(hi) - toMidi(lo), oct = Math.floor(d / 7), dn = d % 7, ss = semi - 12 * oct;
    const PB = { 0: 0, 3: 5, 4: 7 }, MB = { 1: 2, 2: 4, 5: 9, 6: 11 };
    let q;
    if (dn in PB) { const f = ss - PB[dn]; q = f === 0 ? 'P' : f > 0 ? 'A' : 'd'; }
    else { const f = ss - MB[dn]; q = f === 0 ? 'M' : f === -1 ? 'm' : f > 0 ? 'A' : 'd'; }
    const perfect = q === 'P' && (dn === 0 || dn === 4);
    const cons = perfect || ((q === 'M' || q === 'm') && (dn === 2 || dn === 5));
    return { d, dn, q, semi, perfect, cons };
  }

  const QN_JA = { P: '完全', M: '長', m: '短', A: '増', d: '減' };
  const QN_EN = { P: 'perfect', M: 'major', m: 'minor', A: 'augmented', d: 'diminished' };
  function ordinalEn(n) {
    if (n === 1) return 'unison';
    if (n === 8) return 'octave';
    const r10 = n % 10, r100 = n % 100;
    const suf = r100 >= 11 && r100 <= 13 ? 'th' : r10 === 1 ? 'st' : r10 === 2 ? 'nd' : r10 === 3 ? 'rd' : 'th';
    return n + suf;
  }
  // 「長6度」/「major 6th」。ja は GR の ivName と同じ
  function intervalName(iv, lang) {
    if (lang === 'en') return `${QN_EN[iv.q]} ${ordinalEn(iv.d + 1)}`;
    if (lang === undefined || lang === 'ja') return `${QN_JA[iv.q]}${iv.d + 1}度`;
    throw new RangeError(`lang が不明: ${lang}`);
  }

  /* 移調用の音程: { d, semi }(下行は両方を負に)。文字列 "M3"・"-P5"・"A4"・"P12" も受け取る */
  const IV_RE = /^(-?)(P|M|m|A|d)(\d+)$/;
  const BASE_SEMI = [0, 2, 4, 5, 7, 9, 11];
  function parseInterval(str) {
    const m = typeof str === 'string' && str.match(IV_RE);
    if (!m || Number(m[3]) < 1) throw new SyntaxError(`音程として読めない: ${JSON.stringify(str)}`);
    const d = Number(m[3]) - 1, dn = d % 7, q = m[2];
    const perfectKind = dn === 0 || dn === 3 || dn === 4;
    if (perfectKind ? (q === 'M' || q === 'm') : q === 'P') throw new SyntaxError(`ありえない音程: ${str}`);
    let semi = BASE_SEMI[dn] + 12 * Math.floor(d / 7);
    if (q === 'A') semi += 1;
    if (q === 'm') semi -= 1;
    if (q === 'd') semi -= perfectKind ? 1 : 2;
    return m[1] ? { d: -d, semi: -semi } : { d, semi };
  }

  /* 綴りを保つ移調。Pitch には Pitch、PitchClass には PitchClass を返す。
   * 結果の alter が −2〜+2 を外れたら RangeError */
  function transpose(p, iv) {
    if (typeof iv === 'string') iv = parseInterval(iv);
    if (isInt(p.step)) {
      const step = p.step + iv.d;
      const r = { step, alter: 0 };
      r.alter = toMidi(p) + iv.semi - toMidi(r);
      if (!okAlter(r.alter)) throw new RangeError(`移調の結果の変化記号が範囲外: ${formatPitch(p)} + ${JSON.stringify(iv)}`);
      return r;
    }
    const letter = (((p.letter + iv.d) % 7) + 7) % 7;
    let alter = (((PC[p.letter] + p.alter + iv.semi - PC[letter]) % 12) + 12) % 12;
    if (alter > 6) alter -= 12;
    if (!okAlter(alter)) throw new RangeError(`移調の結果の変化記号が範囲外: ${formatPitchClass(p)} + ${JSON.stringify(iv)}`);
    return { letter, alter };
  }

  /* ---------- 進行 ---------- */
  // GR の motion から移した。a0→a1 と b0→b1 の動き: 'none'(どちらも保留)| 'oblique' | 'contrary' | 'similar'
  function motion(a0, a1, b0, b1) {
    const da = toMidi(a1) - toMidi(a0), db = toMidi(b1) - toMidi(b0);
    if (da === 0 && db === 0) return 'none';
    if (da === 0 || db === 0) return 'oblique';
    return Math.sign(da) !== Math.sign(db) ? 'contrary' : 'similar';
  }

  return {
    version,
    LETTERS,
    isPitch, isPitchClass,
    parsePitch, parsePitchClass, formatPitch, formatPitchClass,
    toMidi, fromMidi, pitchClassNumber, fifthsOf,
    samePitchClass, sameSpelling,
    interval, intervalName, parseInterval, transpose,
    motion,
  };
});
