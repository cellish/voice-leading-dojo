// 判定結果の基準（examples.json）を作る。実行: node test/baseline/generate.mjs
// 「今のコードの挙動を記録する」のが目的で、解答が理論的に正しい必要はない。
// 乱数は種を固定した自前の関数（Node の版が変わっても同じ解答になる）。
import { writeFileSync } from 'node:fs';
import { newApp, toStrings, evaluateAll } from './run.mjs';
import { MANUAL } from './manual.mjs';

const OUT = new URL('./examples.json', import.meta.url);
const SEEDS = [11, 22, 33, 44];

function mulberry32(a) {
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const NAT = [0, 2, 4, 5, 7, 9, 11];
const mid = (n) => 12 * (n.o + 1) + NAT[n.l] + n.a;

// 和音の構成音（重複を除く）
function uniqueTones(ex, k) {
    const seen = new Set(), out = [];
    for (const t of ex.bass[k].chord.tones) { const key = t.l + ':' + t.a; if (!seen.has(key)) { seen.add(key); out.push({ l: t.l, a: t.a }); } }
    return out;
}

// (a) 密集配置: バスの上に、構成音を低い順に3つ（T・A・S）
function dense(vl, ex) {
    return ex.bass.map((b, k) => {
        const bm = mid(b.note), cand = [];
        for (const t of uniqueTones(ex, k)) for (let o = 0; o <= 9; o++) { const n = { l: t.l, a: t.a, o }; if (mid(n) > bm) cand.push(n); }
        cand.sort((x, y) => mid(x) - mid(y));
        const [T, A, S] = cand;
        return [S, A, T];
    });
}

// (b) 種を固定してずらしたもの
function shifted(vl, ex, seed) {
    const rnd = mulberry32(seed), base = dense(vl, ex), pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    return base.map((row, k) => row.map((n, v) => {
        const r = rnd(), tones = uniqueTones(ex, k), [lo, hi] = vl.RANGE[v];
        if (r < 0.55) { // 構成音を、声部の音域の中の任意の高さに
            const cands = [];
            for (const t of tones) for (let o = 0; o <= 9; o++) { const m = mid({ ...t, o }); if (m >= lo && m <= hi) cands.push({ ...t, o }); }
            return cands.length ? pick(cands) : n;
        }
        if (r < 0.8) return { ...n, o: n.o + (rnd() < 0.5 ? -1 : 1) }; // 密集配置の音を1オクターヴずらす
        if (r < 0.92) { // 調の中で隣の音へ
            const d = rnd() < 0.5 ? -1 : 1, l = (n.l + d + 7) % 7, o = n.o + (n.l + d >= 7 ? 1 : n.l + d < 0 ? -1 : 0);
            return { l, a: ex.key.sig[l], o };
        }
        const t = pick(tones); return { ...t, o: 3 + Math.floor(rnd() * 4) }; // 構成音を任意のオクターヴに
    }));
}

// (c) 途中まで未入力
const half = (a) => a.map((row, k) => (k < Math.ceil(a.length / 2) ? row : [null, null, null]));
function holes(a, seed) { const rnd = mulberry32(seed); return a.map(row => row.map(n => (rnd() < 0.25 ? null : n))); }

export function buildCases() {
    const vl = newApp(), cases = [];
    for (const e of vl.EXAMPLES) {
        const ex = vl.parseExercise(e.text), base = dense(vl, ex);
        const add = (id, ans) => cases.push({ id: e.id + '/' + id, exercise: e.id, text: e.text, ans: toStrings(vl, ans) });
        add('dense', base);
        SEEDS.forEach(s => add('shift-' + s, shifted(vl, ex, s)));
        add('half', half(base));
        add('holes-77', holes(base, 77));
    }
    for (const m of MANUAL) cases.push({ id: m.id, exercise: m.exercise, text: m.text, ans: m.ans, note: m.note });
    return cases;
}

export function buildBaseline() {
    const vl = newApp(), cases = buildCases();
    for (const c of cases) c.results = evaluateAll(vl, c);
    const coverage = Object.fromEntries([...vl.RULES].map(r => [r.id, 0]));
    for (const c of cases) for (const i of c.results.default.issues) coverage[i.rule]++;
    return { about: 'voice-leading-dojo の check() の結果の基準。node test/baseline/generate.mjs で作り直す（判定を意図して変えたときだけ）', rules: [...vl.RULES].map(r => r.id), coverage, cases };
}

// 1件を1行にして、差分が読めるようにする
function serialize(b) {
    const j = (x) => JSON.stringify(x);
    const lines = ['{', ` "about": ${j(b.about)},`, ` "rules": ${j(b.rules)},`, ` "coverage": ${j(b.coverage)},`, ' "cases": ['];
    b.cases.forEach((c, ci) => {
        lines.push('  {', `   "id": ${j(c.id)}, "exercise": ${j(c.exercise)}, "text": ${j(c.text)},`);
        if (c.note) lines.push(`   "note": ${j(c.note)},`);
        lines.push(`   "ans": ${j(c.ans)},`, '   "results": {');
        const names = Object.keys(c.results);
        names.forEach((n, ni) => {
            const r = c.results[n];
            lines.push(`    ${j(n)}: { "incomplete": ${r.incomplete}, "issues": [`);
            r.issues.forEach((i, ii) => lines.push(`      ${j(i)}${ii < r.issues.length - 1 ? ',' : ''}`));
            lines.push(`    ] }${ni < names.length - 1 ? ',' : ''}`);
        });
        lines.push('   }', `  }${ci < b.cases.length - 1 ? ',' : ''}`);
    });
    lines.push(' ]', '}', '');
    return lines.join('\n');
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
    const b = buildBaseline();
    writeFileSync(OUT, serialize(b));
    const missing = Object.entries(b.coverage).filter(([, n]) => n === 0).map(([id]) => id);
    console.log(`${b.cases.length} 件を ${OUT.pathname} に書きました`);
    console.log('規則ごとの件数:', JSON.stringify(b.coverage));
    console.log('出なかった規則:', missing.length ? missing.join(', ') : 'なし');
}
