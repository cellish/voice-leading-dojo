/* dojo-shared core — rules.js
 * 規則エンジン: 規則の関数の登録、ruleset(版×編成)の定義と読み込み、判定、採点、文言。
 * 純粋な計算だけ(DOM・保存・音・ネットワークに触れない)。規則の中身は src/rules/ の各ファイルが登録する。
 *
 * 規則の2層(D15): 中身は registerRule で登録する関数。どれを使うか・段階・点数・パラメータ・文言は
 * ruleset のデータ(core/data/rulesets/*.json)。
 *
 * 判定の入力(View。楽譜データ score.js ができるまでは、アプリがこの形を作る)
 *   { voices:  [ { id: 'S', name: 'ソプラノ' | { ja, en }, role: 'answer' | 'given' | 'reference' }, … ]  上の声部から順に
 *     columns: [ { notes: [ Pitch | null, … ], attack: [ bool, … ] }, … ] }                             時間順の縦の列
 *   notes[v] は列の時点で鳴っている音(タイで続く音も入れる)。null は休符か未入力。
 *   attack[v] はその列で打鍵するか(タイで続く音・休符は false。未入力でも打鍵する位置なら true)。省くと全部 true。
 *
 * 判定の結果(Issue。review 4.2)
 *   { rule, level: 'error' | 'warn', refs: [ { col, voice }, … ], span: { from, to },
 *     case, vars, msg, why, ruleset }
 *   refs の col は columns の番号、voice は voices[].id。span は refs の列の最小と最大。
 *   case・vars は文言を作る材料(explain で別の言語の文言を作り直せる)。
 *   Issue の並び順に意味はない(並べ方はアプリが決める)。
 * 読み込み順: pitch.js → time.js → key.js → rules.js → rules/*.js
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const deps = isNode ? require('./pitch.js') : root.DojoCore;
  if (!deps || !deps.formatPitch) throw new Error('rules.js は pitch.js の後に読み込む');
  const ns = factory(deps, isNode ? (id) => require('../data/rulesets/' + id + '.json') : null);
  if (isNode) module.exports = ns;
  else root.DojoCore = Object.assign(root.DojoCore || {}, ns);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C, readRuleset) {
  'use strict';

  const version = '0.4.1';
  const LEVELS = ['error', 'warn'];
  const OVERRIDES = ['error', 'warn', 'off'];
  const ROLES = ['answer', 'given', 'reference'];

  const clone = (x) => JSON.parse(JSON.stringify(x));
  const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

  /* ---------- 規則の関数 ---------- */
  /* fn(view, params, ctx) → [ { refs, case?, vars? }, … ]
   *   ctx = { pairs(kind), attacks(v), voicesOf(roles), voice(v), memo(key, make) }(rules/ の各ファイルが共通に使う道具) */
  const registry = Object.create(null);
  function registerRule(id, fn) {
    if (typeof id !== 'string' || !id) throw new TypeError('規則の id が文字列でない');
    if (typeof fn !== 'function') throw new TypeError(`規則 ${id} の関数がない`);
    if (registry[id] && registry[id] !== fn) throw new Error(`規則 ${id} はもう別の関数で登録されている`);
    registry[id] = fn;
  }
  function registeredRules() { return Object.keys(registry); }

  /* ---------- ruleset ---------- */
  /* { id, style, texture, name?, extends?, params?, rules: [ entry, … ] }
   *   entry = { rule, level, points?, name?, params?, text?, app?, impl?, legacyId? }
   *     app: true   まだコアに移していない規則(judge は飛ばす。段階・点数・名前はアプリが読む)
   *     impl        登録した関数の id(省くと rule と同じ。1つの関数を2つの id で使うとき)
   *     text        { ja: { msg, why }, en: … }。msg・why は文字列か、case ごとの文字列の表({ fifth: …, octave: … })
   *     legacyId    アプリが今まで使っていた id(移行のための記録) */
  const rulesets = Object.create(null);

  function checkEntry(rsId, e) {
    if (!isObj(e) || typeof e.rule !== 'string' || !e.rule) throw new TypeError(`ruleset ${rsId}: 規則の項目に rule がない`);
    if (!LEVELS.includes(e.level)) throw new TypeError(`ruleset ${rsId}: ${e.rule} の level が不明: ${e.level}`);
    if (e.points !== undefined && !(typeof e.points === 'number' && e.points >= 0)) throw new TypeError(`ruleset ${rsId}: ${e.rule} の points が不正`);
    if (e.params !== undefined && !isObj(e.params)) throw new TypeError(`ruleset ${rsId}: ${e.rule} の params がオブジェクトでない`);
    if (e.app !== undefined && typeof e.app !== 'boolean') throw new TypeError(`ruleset ${rsId}: ${e.rule} の app が真偽値でない`);
  }

  // extends は先に定義した ruleset。同じ rule の項目は子が置き換える(params だけは親に重ねる)。子の新しい規則は後ろに足す
  function defineRuleset(def) {
    if (!isObj(def) || typeof def.id !== 'string' || !def.id) throw new TypeError('ruleset に id がない');
    if (!Array.isArray(def.rules)) throw new TypeError(`ruleset ${def.id}: rules が配列でない`);
    def = clone(def);
    def.rules.forEach((e) => checkEntry(def.id, e));
    const seen = new Set();
    for (const e of def.rules) {
      if (seen.has(e.rule)) throw new Error(`ruleset ${def.id}: ${e.rule} が2回ある`);
      seen.add(e.rule);
    }
    let rules = def.rules, params = def.params || {};
    if (def.extends) {
      const parent = rulesets[def.extends];
      if (!parent) throw new Error(`ruleset ${def.id}: extends の ${def.extends} が定義されていない`);
      rules = parent.rules.map((p) => {
        const c = def.rules.find((e) => e.rule === p.rule);
        return c ? Object.assign({}, c, { params: Object.assign({}, p.params, c.params) }) : clone(p);
      });
      for (const e of def.rules) if (!parent.rules.some((p) => p.rule === e.rule)) rules.push(e);
      params = Object.assign({}, parent.params, params);
    }
    const rs = Object.assign({}, def, { params, rules });
    rulesets[rs.id] = rs;
    return clone(rs);
  }

  /* id(文字列)か ruleset のデータ(オブジェクト)。id は先に defineRuleset したもの、
   * Node では core/data/rulesets/<id>.json も読む。ブラウザではアプリが JSON を渡して定義する */
  function loadRuleset(idOrDef) {
    if (isObj(idOrDef)) return defineRuleset(idOrDef);
    if (typeof idOrDef !== 'string') throw new TypeError('ruleset の id かデータを渡す');
    if (rulesets[idOrDef]) return clone(rulesets[idOrDef]);
    if (!readRuleset) throw new Error(`ruleset ${idOrDef} が定義されていない(ブラウザでは JSON を loadRuleset に渡す)`);
    if (!/^[a-z0-9-]+$/.test(idOrDef)) throw new Error(`ruleset の id が不正: ${idOrDef}`);
    let def;
    try { def = readRuleset(idOrDef); } catch (e) { throw new Error(`ruleset ${idOrDef} が見つからない`); }
    return defineRuleset(def);
  }

  /* ---------- 入力の確かめと道具 ---------- */
  function checkView(view) {
    if (!isObj(view) || !Array.isArray(view.voices) || !Array.isArray(view.columns)) throw new TypeError('View は { voices, columns }');
    const n = view.voices.length;
    if (n < 1) throw new TypeError('View の voices が空');
    const ids = new Set();
    for (const v of view.voices) {
      if (!isObj(v) || typeof v.id !== 'string' || !v.id) throw new TypeError('voices の各要素に id がない');
      if (ids.has(v.id)) throw new TypeError(`voices の id が重なる: ${v.id}`);
      ids.add(v.id);
      if (!ROLES.includes(v.role)) throw new TypeError(`voices ${v.id} の role が不明: ${v.role}`);
    }
    view.columns.forEach((c, i) => {
      if (!isObj(c) || !Array.isArray(c.notes) || c.notes.length !== n) throw new TypeError(`columns[${i}].notes の長さが voices と違う`);
      c.notes.forEach((p, v) => { if (p !== null && !C.isPitch(p)) throw new TypeError(`columns[${i}].notes[${v}] が音高でない`); });
      if (c.attack !== undefined && (!Array.isArray(c.attack) || c.attack.length !== n)) throw new TypeError(`columns[${i}].attack の長さが voices と違う`);
    });
  }

  function makeCtx(view) {
    const n = view.voices.length, memos = Object.create(null);
    return {
      // 1回の judge の中で規則どうしが計算を使い回すための入れ物(同じ key には同じものを返す)
      memo(key, make) { if (!(key in memos)) memos[key] = make(); return memos[key]; },
      // 声部の組。上の声部が先([上, 下])
      pairs(kind) {
        const out = [];
        if (kind === 'outer') { if (n > 1) out.push([0, n - 1]); }
        else if (kind === 'adjacent') { for (let i = 0; i + 1 < n; i++) out.push([i, i + 1]); }
        else if (kind === 'all' || kind === undefined) { for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([i, j]); }
        else throw new RangeError(`声部の組の指定が不明: ${kind}`);
        return out;
      },
      // その声部が打鍵する列の番号(音が未入力の列も含む)
      attacks(v) {
        const out = [];
        view.columns.forEach((c, i) => { if (!c.attack || c.attack[v]) out.push(i); });
        return out;
      },
      // params.roles(既定 ['answer'])に入る声部の番号
      voicesOf(roles) {
        roles = roles || ['answer'];
        return view.voices.map((v, i) => (roles.includes(v.role) ? i : -1)).filter((i) => i >= 0);
      },
      voice(v) { const x = view.voices[v]; return { voice: x.id, name: x.name === undefined ? x.id : x.name }; },
    };
  }

  /* ---------- 文言 ---------- */
  function pick(t, kase) {
    if (t === undefined || t === null) return '';
    if (typeof t === 'string') return t;
    if (kase !== undefined && t[kase] !== undefined) return t[kase];
    if (t.default !== undefined) return t.default;
    throw new Error(`文言に case ${kase} が無い`);
  }
  function fmtVar(x, lang, opts) {
    if (C.isPitch(x)) return C.formatPitch(x, { style: (opts && opts.noteStyle) || 'unicode' });
    if (isObj(x)) return x[lang] !== undefined ? x[lang] : (x.ja !== undefined ? x.ja : '');
    return String(x);
  }
  function fill(tpl, vars, lang, opts) {
    if (tpl.indexOf('{') < 0) return tpl;
    return tpl.replace(/\{(\w+)\}/g, (m, k) => {
      if (!vars || vars[k] === undefined) throw new Error(`文言の {${k}} に当てる値がない`);
      return fmtVar(vars[k], lang, opts);
    });
  }
  function textOf(entry, issue, lang, opts) {
    const t = entry.text && entry.text[lang];
    if (!t) return { msg: '', why: '' };
    return { msg: fill(pick(t.msg, issue.case), issue.vars, lang, opts), why: fill(pick(t.why, issue.case), issue.vars, lang, opts) };
  }

  // 規則の説明文(日英)。en が空なら msg・why は ''(D: 英語は最初は空でよい)
  function explain(issue, lang, opts) {
    const rs = rulesets[issue && issue.ruleset];
    if (!rs) throw new Error(`Issue の ruleset ${issue && issue.ruleset} が定義されていない`);
    const entry = rs.rules.find((e) => e.rule === issue.rule);
    if (!entry) throw new Error(`ruleset ${rs.id} に規則 ${issue.rule} が無い`);
    return textOf(entry, issue, lang || 'ja', opts);
  }

  /* ---------- 判定 ---------- */
  /* judge(view, ruleset, opts) → Issue[]
   *   ruleset  id か defineRuleset の結果
   *   opts.levels    { 規則id: 'error' | 'warn' | 'off' }(段階だけを置き換える。線引きは変えない)
   *   opts.scope     規則 id の配列(この規則だけ判定する)
   *   opts.lang      文言の言語(既定 'ja')
   *   opts.noteStyle 文言の音名の書き方(pitch.js の style。既定 'unicode') */
  function judge(view, ruleset, opts) {
    opts = opts || {};
    const rs = typeof ruleset === 'string' ? loadRuleset(ruleset) : ruleset;
    if (!isObj(rs) || !rulesets[rs.id]) throw new Error('ruleset は id か defineRuleset の結果を渡す');
    checkView(view);
    const levels = opts.levels || {};
    for (const [k, v] of Object.entries(levels)) if (!OVERRIDES.includes(v)) throw new RangeError(`levels.${k} が不明: ${v}`);
    const lang = opts.lang || 'ja';
    const ctx = makeCtx(view);
    const out = [];
    for (const entry of rulesets[rs.id].rules) {
      if (entry.app) continue;
      if (opts.scope && !opts.scope.includes(entry.rule)) continue;
      const level = levels[entry.rule] || entry.level;
      if (level === 'off') continue;
      const fn = registry[entry.impl || entry.rule];
      if (!fn) throw new Error(`規則 ${entry.impl || entry.rule} の関数が登録されていない(rules/ のファイルを読み込む)`);
      for (const f of fn(view, entry.params || {}, ctx)) {
        const cols = f.refs.map((r) => r.col);
        const issue = {
          rule: entry.rule, level, refs: f.refs,
          span: { from: Math.min(...cols), to: Math.max(...cols) },
          case: f.case, vars: f.vars || {}, ruleset: rs.id,
        };
        Object.assign(issue, textOf(entry, issue, lang, opts));
        out.push(issue);
      }
    }
    return out;
  }

  /* ---------- 採点 ---------- */
  /* grade(issues, scheme) → { total, items: [ { rule, level, points, refs } ], counts: { error, warn }, pass }
   *   scheme   ruleset(id かデータ。points を使う)か { points: { 規則id: 点 }, defaultPoints }
   *   点数の既定は 1。pass は error が0件(書き終えたかどうかはアプリが見る) */
  function grade(issues, scheme) {
    if (!Array.isArray(issues)) throw new TypeError('issues が配列でない');
    let pointsOf;
    const rs = typeof scheme === 'string' ? loadRuleset(scheme) : scheme;
    if (isObj(rs) && Array.isArray(rs.rules)) {
      const table = {};
      for (const e of rs.rules) if (e.points !== undefined) table[e.rule] = e.points;
      pointsOf = (id) => (table[id] !== undefined ? table[id] : 1);
    } else {
      const s = rs || {};
      const def = s.defaultPoints === undefined ? 1 : s.defaultPoints;
      pointsOf = (id) => (s.points && s.points[id] !== undefined ? s.points[id] : def);
    }
    const items = issues.map((x) => ({ rule: x.rule, level: x.level, points: pointsOf(x.rule), refs: x.refs }));
    const counts = { error: 0, warn: 0 };
    for (const x of issues) if (counts[x.level] !== undefined) counts[x.level]++;
    return { total: items.reduce((a, x) => a + x.points, 0), items, counts, pass: counts.error === 0 };
  }

  return {
    version,
    registerRule, registeredRules, defineRuleset, loadRuleset, judge, grade, explain,
  };
});
