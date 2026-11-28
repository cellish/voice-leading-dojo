// index.html のスクリプトを、ブラウザの代わりの最小限のスタブ（DOM・localStorage）の上で読み込む。
// 内部関数（check・parseExercise・st など）を __vl として取り出し、Node から check() を呼べるようにする。
// index.html は変えない。取り出しは、読み込んだスクリプトの文字列の IIFE の最後に差し込む形で行う。
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const HTML_PATH = new URL('../index.html', import.meta.url);
const THEORY_PATH = new URL('../js/theory.js', import.meta.url);

function loadScript() {
    const html = readFileSync(HTML_PATH, 'utf8');
    const start = html.indexOf('<script>\n') + '<script>\n'.length; // src の付かない（インラインの）スクリプト
    const end = html.lastIndexOf('</script>');
    let js = html.slice(start, end);
    const tail = js.lastIndexOf('})();');
    if (tail < 0) throw new Error('index.html のスクリプトの終わり（})();）が見つかりません');
    js = js.slice(0, tail) + `
    globalThis.__vl = { check, st, EXAMPLES, RULES, RANGE, parseExercise, parseNote, nName, midi, dia, setEx };
` + js.slice(tail);
    return js;
}

function makeElement() {
    const classes = new Set();
    const el = {
        style: {}, dataset: {}, children: [], value: '', checked: false, options: [], textContent: '', innerHTML: '', id: '', className: '',
        classList: {
            add: (...cs) => cs.forEach(c => classes.add(c)), remove: (...cs) => cs.forEach(c => classes.delete(c)),
            contains: c => classes.has(c), toggle: (c, f) => { if (f === undefined) f = !classes.has(c); f ? classes.add(c) : classes.delete(c); }
        },
        addEventListener() {}, setAttribute(k, v) { this['@' + k] = v; }, getAttribute(k) { return this['@' + k]; }, removeAttribute() {},
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
    vm.runInContext(readFileSync(THEORY_PATH, 'utf8'), context, { filename: 'js/theory.js' });
    vm.runInContext(loadScript(), context, { filename: 'index.html' });
    return { vl: context.__vl, elements };
}
