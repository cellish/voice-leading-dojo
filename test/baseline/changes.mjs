// 記録(examples.json)と、今のコードの check() の結果の差を、作者が確かめるための一覧(Markdown)にする。
// 使い方: node test/baseline/changes.mjs > test/baseline/CHANGES-3b.md
// 記録は変えない(記録を作り直すのは、作者が一覧を確かめてから node test/baseline/generate.mjs で)。
import { readFileSync } from 'node:fs';

// node --test が test/ の下の .mjs として実行したときは何もしない
if (process.env.NODE_TEST_CONTEXT) process.exit(0);
import { newApp, evaluate, CONFIGS } from './run.mjs';

const base = JSON.parse(readFileSync(new URL('./examples.json', import.meta.url), 'utf8'));
const vl = newApp();
const key = (x) => JSON.stringify(x);
const cellStr = (cells) => cells.map(([k, v]) => `${k + 1}${'SATB'[v]}`).join(' ');

// 多重集合の差
function diff(before, after) {
  const a = before.map(key), b = after.map(key);
  const removed = [], added = [];
  const rest = b.slice();
  for (const x of a) { const i = rest.indexOf(x); if (i >= 0) rest.splice(i, 1); else removed.push(JSON.parse(x)); }
  added.push(...rest.map((x) => JSON.parse(x)));
  // 規則・場所が同じで文言だけが違うものは「文言の変化」として組にする
  const changed = [];
  for (const r of removed.slice()) {
    const i = added.findIndex((x) => x.rule === r.rule && x.sev === r.sev && key(x.cells) === key(r.cells));
    if (i >= 0) { changed.push({ before: r, after: added[i] }); added.splice(i, 1); removed.splice(removed.indexOf(r), 1); }
  }
  return { removed, added, changed };
}

const lines = [];
const out = (s = '') => lines.push(s);
const summary = {};
const tally = (rule, kind) => { summary[rule] = summary[rule] || { added: 0, removed: 0, changed: 0 }; summary[rule][kind]++; };
const perCase = [];
let allErrorOnlySev = true;

for (const c of base.cases) {
  const now = evaluate(vl, c, 'default'), was = c.results.default;
  const d = diff(was.issues, now.issues);
  // 全部 error の設定でも、同じ差(重さが error になるだけ)であることを確かめる
  const nowE = evaluate(vl, c, 'allError'), dE = diff(c.results.allError.issues, nowE.issues);
  const strip = (xs) => xs.map((x) => key({ rule: x.rule, cells: x.cells })).sort();
  if (key(strip(dE.removed)) !== key(strip(d.removed)) || key(strip(dE.added)) !== key(strip(d.added))) allErrorOnlySev = false;
  if (!d.removed.length && !d.added.length && !d.changed.length && was.incomplete === now.incomplete) continue;
  perCase.push({ c, d });
  d.added.forEach((x) => tally(x.rule, 'added'));
  d.removed.forEach((x) => tally(x.rule, 'removed'));
  d.changed.forEach((x) => tally(x.before.rule, 'changed'));
}

out('# 段階3b で変わる VL の判定(作者の確認用)');
out();
out('`node test/baseline/changes.mjs` で作った一覧。記録 `test/baseline/examples.json`(既定の設定)と、段階3b の修正後の `check()` の結果の差。');
out('**この一覧を作者が確かめてから**、`node test/baseline/generate.mjs` で記録を作り直す(QUEUE T18)。');
out();
out('## 何を変えたか');
out();
out('- **core 0.5.0(T17、D27(a)(b))**: 同度のまま並行すると「連続8度」と出ていたのを「連続1度（同度）」に。外声(ソプラノ–バス)が同じ向きに進み、ソプラノが跳躍して完全協和へ入るとき、前が別の種類の完全協和(5度→8度、8度→5度)でも `hidden`(並達)に');
out('- **augMel(D14、VL の規則)**: S・A・T の、増2度・増4度・増5度(複音程は単音程に直す)と、直後に反対方向へ2度進まない減5度。同じ音名の半音の動き(増1度)は当てない。減5度の次の音が未入力なら保留、最後の和音へ減5度で入ったら当てる。今までは S・A・T の増2度・増4度(単音程)だけ');
out('- **バス**(与えられた声部)は判定に出さない。課題を読み込むときに「バスの第n→n+1音が増2度です。実施では直せないので、判定には出しません。」と知らせる(例題6つのバスには当たるものが無い)');
out();
out('## 確かめてほしい点');
out();
out('1. **外声の8度→5度も並達5度になる**: D27(b) は「5度→8度」だけを挙げていたが、教本の通常の定義(同じ向きの動きで完全協和へ入り、前が同じ種類の完全協和でないもの。GR と同じ)に合わせたので、8度→5度も当たる(下の `ex2/shift-33`・`ex3/shift-33`・`ex4/shift-44` の「並達5度」)。5度→8度だけにするなら、コアにパラメータを足す');
out('2. **複音程の名前**: 増音程は単音程に直して当てる(作者の決定)。名前は単音程の名前にオクターヴを添える(「増4度（2オクターヴ上）」「減5度（1オクターヴ下）」。作者の確認で決定)。オクターヴを超える跳躍には `leap` も出る');
out('3. **減5度の文言**: 「…が減5度で進み、次に反対方向へ2度進んでいません」、最後の和音へ入るときは「…が減5度で最後の和音へ進んでいます（減5度の後は反対方向へ2度進んで解決します）」。次の音が未入力の間は出さない');
out('4. **増2度・増4度の文言は今までと同じ**(「…が増2度で進んでいます」)。今まで出ていた `augMel` で、消えたり変わったりしたものは無い');
out();
out('## まとめ');
out();
out(`変わった解答: ${perCase.length} / ${base.cases.length}。全部 error の設定でも、同じ差(重さが error になるだけ)か: ${allErrorOnlySev ? 'はい' : '**いいえ(要確認)**'}`);
out();
out('| 規則 | 増える | 消える | 文言だけ変わる |');
out('|---|---|---|---|');
for (const [r, s] of Object.entries(summary).sort()) out(`| \`${r}\` | ${s.added} | ${s.removed} | ${s.changed} |`);
out();
out('場所は「和音の番号+声部」(例 `3S` = 第3和音のソプラノ)。');
out();
out('## 解答ごとの変化');
for (const { c, d } of perCase) {
  out();
  out(`### ${c.id}`);
  out();
  out(`課題 \`${c.text.trim()}\`  `);
  out(`解答(S A T、和音ごと): ${c.ans.map((r, k) => `${k + 1}: ${r.map((x) => x || '−').join(' ')}`).join(' / ')}`);
  out();
  for (const x of d.changed) out(`- 文言 \`${x.before.rule}\` ${cellStr(x.before.cells)}: 「${x.before.msg}」→「${x.after.msg}」`);
  for (const x of d.added) out(`- **増える** \`${x.rule}\`(${x.sev}) ${cellStr(x.cells)}: ${x.where} ${x.msg}`);
  for (const x of d.removed) out(`- **消える** \`${x.rule}\`(${x.sev}) ${cellStr(x.cells)}: ${x.where} ${x.msg}`);
}
out();
console.log(lines.join('\n'));
