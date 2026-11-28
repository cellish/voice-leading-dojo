// index.html が読み込む js/*.js を、ブラウザの代わりの最小限のスタブ（DOM・localStorage）の上で、書かれた順に読み込む。
// 内部の名前（check・st・EXAMPLES など）は __vl として取り出し、Node から check() を呼べるようにする。
// index.html と js/ は変えない。取り出しは、読み込み終わったあとに別のスクリプトとして実行する形で行う
// （classic script の最上位の const は、同じ環境で実行する別のスクリプトから見える）。
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const HTML_PATH = new URL('../index.html', import.meta.url);

// index.html の <script src="…"> を、書かれた順に返す
function scriptPaths() {
    const html = readFileSync(HTML_PATH, 'utf8');
    const paths = [...html.matchAll(/<script\s+src="([^"]+)"><\/script>/g)].map(m => m[1]).filter(p => !/^https?:/.test(p));
    if (!paths.length) throw new Error('index.html に <script src> が見つかりません');
    return paths;
}

const EXPOSE = 'globalThis.__vl = { check, st, EXAMPLES, RULES, RANGE, parseExercise, parseNote, nName, midi, dia, setEx, get geo() { return geo; } };';

function makeElement() {
    const classes = new Set();
    const el = {
        style: {}, dataset: {}, children: [], value: '', checked: false, options: [], textContent: '', innerHTML: '', id: '', className: '',
        classList: {
            add: (...cs) => cs.forEach(c => classes.add(c)), remove: (...cs) => cs.forEach(c => classes.delete(c)),
            contains: c => classes.has(c), toggle: (c, f) => { if (f === undefined) f = !classes.has(c); f ? classes.add(c) : classes.delete(c); }
        },
        listeners: {}, addEventListener(type, f) { this.listeners[type] = f; }, setAttribute(k, v) { this['@' + k] = v; }, getAttribute(k) { return this['@' + k]; }, removeAttribute() {},
        append(...cs) { this.children.push(...cs); }, appendChild(c) { this.children.push(c); return c; },
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 300 }),
        focus() {}, blur() {}
    };
    return el;
}

/**
 * アプリを読み込む。
 * @param {object} opts.storage  localStorage の初期内容（キー → 文字列）。省略時は空（既定の設定）
 * @returns {{ vl, elements }}  vl は check・st・EXAMPLES・RULES など。vl.st は vm の別環境の値
 */
export function loadApp({ storage = {} } = {}) {
    const elements = {};
    const getEl = (id) => elements[id] || (elements[id] = makeElement());
    const store = { ...storage };
    const context = vm.createContext({
        console: { log: console.log, error: console.error, warn() {} }, Math, JSON, Number, String, Array, Object, Set, Map, Error, RegExp, Float32Array,
        document: {
            activeElement: { tagName: 'BODY' }, getElementById: getEl, createElement: makeElement,
            createTextNode: (t) => ({ textContent: t }), addEventListener() {}, fonts: null
        },
        window: {},
        setTimeout: () => 1, clearTimeout() {},
        localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }
    });
    for (const p of scriptPaths()) vm.runInContext(readFileSync(new URL('../' + p, import.meta.url), 'utf8'), context, { filename: p });
    vm.runInContext(EXPOSE, context, { filename: 'expose' });
    return { vl: context.__vl, elements };
}
