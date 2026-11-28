# core の変更履歴

書法の部品(`DojoCore`)。版番号の上げ方は `../CLAUDE.md`。タグは `core-v<版>`(例 `core-v0.1.0`)。

## 0.4.1(2026-11-28)
速さだけの修正(QUEUE T14。GR の解答探索は候補ごとに判定するため)。入出力と判定は変わらない。

- `rules/motion.js`: 平行・反行・隠伏が、完全協和へ入る進行の一覧を1回の `judge` の中で共有する(今までは規則ごとに作り直していた)
- `rules.js`: 置き換える値(`{…}`)の無い文言は、そのまま返す
- GR の `analyze` 1回の時間(第3類、41スロット): 置き換え前 約29µs → 0.4.0 約47〜64µs → 0.4.1 約39µs

アプリ側の移し方: `src/` をコピーし直すだけ。

(版は変えない追記)`data/rulesets/<id>.js` は `node tools/embed-data.mjs` で `<id>.json` から作る(D28。`--check` で一致だけを確かめる。今ある2つと同じ出力)。

## 0.4.0(2026-11-28)
QUEUE T14(GR の取り込み)の準備。判定は変わらない。

- `data/rulesets/strict-2v.js`・`tonal-4v.js` を足した。`.json` と同じ中身を `<script>`・Worker の `importScripts`・Node の `require` で読める形にしたもの(core はネットワークに触れないので、ブラウザで JSON を fetch しない。作者の決定 2026-11-28)。`rules.js` の後に読み込むと `DojoCore.loadRuleset` で定義する。Node の `require` はデータをそのまま返す。**正本は `.json`**。直すときは両方を同じに直す(`core/test/rulesets.test.js` が一致を確かめる)
- `judge` の道具 `ctx.memo(key, make)`(1回の判定の中で規則どうしが計算を使い回す)。`rules/motion.js` の平行・反行・隠伏が、列ごとの完全協和の種類を使い回す(GR の解答探索は候補ごとに判定するため、速さのため)

アプリ側の移し方: 使う ruleset の `.js` を `vendor/dojo-shared/core/data/rulesets/` にコピーし、`rules/*.js` の後に読み込む(Worker なら `importScripts` にも)。0.3.0 からの入出力の変更はない。

## 0.3.0(2026-11-28)
段階3の前半(QUEUE T13)。規則エンジンと、声部対の規則6つ(7つの id)。読み込み順は `pitch.js` → `time.js` → `key.js` → `rules.js` → `rules/motion.js` → `rules/melodic.js`(`rules/` の2つは読み込むと規則を登録する)。

- `rules.js`: `registerRule`・`registeredRules`・`defineRuleset`・`loadRuleset`・`judge`・`grade`・`explain`
  - 判定の入力は **View** `{ voices: [{id, name, role}], columns: [{notes, attack}] }`(上の声部から順、列は時間順)。楽譜データ(`score.js`、段階7)ができるまでは、アプリがこの形を作る
  - 結果は **Issue** `{ rule, level: 'error'|'warn', refs: [{col, voice}], span: {from, to}, case, vars, msg, why, ruleset }`(review 4.2。`refs` は楽譜データができるまで列の番号で指す)。並び順に意味はない
  - `judge(view, ruleset, { levels, scope, lang, noteStyle })`。`levels` は段階だけを置き換える(GR の `levels`・VL の `cfg.sev` と同じ。`'off'` は出さない)
  - `loadRuleset` は Node では `core/data/rulesets/<id>.json` を読む。**ブラウザではアプリが JSON を渡す**(`loadRuleset(json)`。core はネットワークに触れないため)
  - `grade(issues, ruleset)` は ruleset の `points`(既定 1)を足す。GR の「3度・6度の連続」の累進と全体減点はアプリに残る
- `rules/motion.js`: `parallel`(`parallelPerfect`)・`contrary`(`contraryPerfect`)・`hidden`(`hiddenPerfect`)・`crossing`、`perfectKind`
- `rules/melodic.js`: `leap`(`melodicLeap`)・`ambitus`・`range`(`voiceRange`)
- `data/rulesets/strict-2v.json`(GR の「フックス厳格」)と `tonal-4v.json`(VL の既定)。どちらもアプリの**全規則**の段階・点数・名前を持ち、まだコアに無い規則は `"app": true`(judge は飛ばす)
- GR と VL の違いはパラメータで残した(D14、prep 5.4):

| 規則 | strict-2v(GR) | tonal-4v(VL) |
|---|---|---|
| `parallel`・`contrary` | `skipCrossed: true`(後の列で交差した組を除く) | 全6組、交差も見る |
| `hidden` | 前が同じ仲間の完全協和でなければ当てる(5度→8度も)、跳躍の条件なし、refs は前後4音、error | 外声だけ、前が完全協和でないときだけ、ソプラノが3半音以上、refs は後の2音、warn |
| `crossing` | 綴りの度数で比べる | 半音で比べる、全声部がそろったときだけ |
| `leap` | オクターヴ超を度数で測る、error | 半音で測る(13半音以上)、warn |
| `ambitus` | 対旋律の幅が10度を超える(旧 `range`)、warn | — |
| `range` | — | S 60–79・A 55–74・T 48–67(MIDI)、warn |

**判定は変えていない。** 確かめたこと(`node --test`):
- GR: `analyze` の6規則の結果(規則・段階・`cols`・見出し・説明)と同じ。`test/engine.test.js` の声部対の例7つ、「学ぶ」の模範例と悪い例(第1〜5類)、乱数の対旋律 2,400 通り(第1〜5類・上下・未入力・変化音・タイの切れ目。6規則とも数十〜数千回出る)、`lenient` の段階の置き換え(`core/test/gr-rules-parity.test.js`)
- VL: `test/baseline/examples.json` の全解答で、6規則の結果(規則・重さ・`cells`・文言)が既定・全部 error とも同じ(`core/test/vl-rules-parity.test.js`)
- 既知の怪しい挙動(D27 (a) 同度の並行を「連続8度」と言う、(b) 外声の5度→8度が `hidden` にならない)は**そのまま**移した。直すのは段階3b

アプリ側の移し方(T14・T15):
- `vendor/dojo-shared/core/` に `VERSION`・`CHANGELOG.md`・`src/`(`src/rules/` を含む)と、使う ruleset の `data/rulesets/<id>.json` をコピーする。`index.html` などの読み込みに `rules.js`・`rules/motion.js`・`rules/melodic.js` を足す
- ruleset の JSON をアプリが読んで `DojoCore.loadRuleset(json)` に渡す(fetch か、HTML への埋め込み。どちらにするかは各アプリで決める)
- 判定の入力の View を作る:
  - **GR**: 列 = スロット。声部は `above` なら `[対旋律, 定旋律]`、でなければ逆。`notes` は `valsOf` の値と `cf[slot.m]`(`{step: s, alter: a}` に読み替え)、`attack` は対旋律が `editable(slot)`、定旋律が `slot.b === 0`。対旋律の `role` は `answer`、定旋律は `given`
  - **VL**: 列 = 和音。声部は `S・A・T・B`(id はこのとおり。`range` の音域が id で引くため)、バスは `given`。`notes` は `toPitch` で読み替えた音
- Issue → アプリの形:
  - **GR**: `id` は旧 id に戻す(`contrary`→`antiparallel`、`leap`→`leapBig`、`ambitus`→`range`。ruleset の各項目の `legacyId`)、`lv` は `error`→`err`、`cols` は `refs` の `col` の重なりを除いた並び、`t` = `msg`、`x` = `why`。`levels` は新しい id に読み替えて渡す
  - **VL**: `sev` = `level`、`cells` = `refs` の `[col, 声部の番号]`、`msg` = `msg`、`where` はアプリが列から作る。並び順(和音ごと)はアプリが付け直す
- 判定の線引きは同じなので、取り込みの前後で GR の `node test/engine.test.js`、VL の `node --test`(`examples.json` は1文字も変えない)が通るはず

## 0.2.0(2026-11-28)
QUEUE T12(VL の音高の計算をコアに置き換える)で足りなかったもの。日本式の音名は VL(調の名前)と HA(`singing.html` の `JA_KEY`)が使う。

- `pitch.js`: `formatPitch`・`formatPitchClass` の `style` に `'ja'` を足した。ハ・ニ・ホ・ヘ・ト・イ・ロ、変化記号は前に付ける(嬰ヘ・変ロ・重嬰ハ・重変ロ)。`formatPitch` のオクターヴは数字のまま(`'変ホ4'`)
- `key.js`: `formatKey(key, { style: 'ja' })` は「変ロ長調」「嬰ヘ短調」
- 既存の関数の入出力・判定は変わらない(足しただけ。版の決まりで MINOR)

アプリ側の移し方: 0.1.0 からはそのままコピーし直すだけでよい。

## 0.1.0(2026-11-28)
段階1(QUEUE T08)。`core/src/` に最初の3ファイル。読み込み順は `pitch.js` → `time.js` → `key.js`(key.js は前の2つを使う)。

- `pitch.js`: 綴りつき音高 `{step, alter}`(C4=28、alter −2〜+2)とオクターヴの無い音名 `{letter, alter}`
  - `parsePitch`・`formatPitch`(`ascii`・`unicode`・`german`)・`parsePitchClass`・`formatPitchClass`
  - `toMidi`(C4=60)・`fromMidi(midi, ctx)`(綴りは `ctx.tones` → `ctx.key` → `ctx.prefer` の順で決める)
  - `samePitchClass`(異名同音を同じとみなす)・`sameSpelling`(文字と変化記号。オクターヴは見ない。VL の `same` と同じ)
  - `interval`・`intervalName`(ja・en)・`parseInterval`・`transpose`(綴りを保つ)・`motion`
  - **`interval` と `motion` は GR(gradus-dojo `js/engine.js`)の `interval`・`motion` から移した**。音高の形を GR の `{s, a}` から `{step, alter}` に読み替えただけで、計算と戻り値(`{d, dn, q, semi, perfect, cons}`、`'none'|'oblique'|'contrary'|'similar'`)は同じ。重増・重減も GR と同じく `'A'`・`'d'`。`intervalName` の ja は GR の `ivName` と同じ文字列。GR との一致は `core/test/gr-parity.test.js` で全組み合わせを比べる
- `time.js`: 有理数 `[n, d]`(`frac`・`add`・`sub`・`mul`・`div`・`cmp`・`eq`・`toNumber` など)、拍子(`meter`・`barLength`)、小節(`barPosition`・`barOf`・`beatOf`・`barStart`。拍子の変化の列にも対応)
- `key.js`: 調 `{tonic, mode}`(`parseKey`・`formatKey`・`keySignature`・`scaleOf(key, form)`・`leadingTone`・`degreeOf`・`transposeKey`・`keyAt`)。短音階の形 `natural`・`harmonic`・`melodic` は呼ぶ側が選ぶ
- まだ無いもの: `time.js` の `splitToNotatable`・`validateBars`、`key.js` の `modeOfFinal`(PLAN.md)

アプリ側の移し方(T09、GR): GR の `{s, a}` は `{step: s, alter: a}` に読み替える。保存形式(文字列 `'D4'`)は変えない。

## 0.0.0(2026-11-28)
- 骨組みだけ。`src/`・`data/`・`test/` は空。課題集は `tasks/README.md`(書き方)だけ

## 取り込み済みのアプリ
版を上げたら、下のアプリの確認手順を全部走らせる。

| アプリ | 取り込んだ版 | 確認手順 |
|---|---|---|
| GR | 0.4.1 | node test/engine.test.js(判定の記録 test/baseline/ との照合を含む)と 1280/390px の画面。版を上げたら core/test/gr-rules-parity.test.js も |
| VL | 0.2.0 | node --test(voice-leading-dojo 直下)と 1280/480px の画面 |
