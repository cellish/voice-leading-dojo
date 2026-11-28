# CLAUDE.md（和声道場 / Voice-Leading Dojo）

数字付き低音（林達也『新しい和声』の表記）から4声体を書く練習アプリ。現状は `STATUS.md`、未完了の作業は `PLAN.md`、中身の一覧は `docs/INVENTORY.md`。

## 構成
- `index.html`：アプリ本体の HTML。`css/style.css` と `js/*.js`（classic script。この順に読む）を読み込む。ビルドもパッケージ管理もない。
- `js/theory.js`：DOM・localStorage・画面の状態に触れない計算部（音名・調・数字付き低音の解析・`RULES`・`check`）。ブラウザでは `VLT`、Node では `require` で使う。`check(ex, ans, cfg)` は課題・解答・設定を引数で受け取る。
- `js/state.js`（状態 `st`・保存・計算部の呼び出し口）、`js/staff.js`（譜表の描画）、`js/audio.js`（音）、`js/app.js`（画面・操作・起動）。最上位の宣言は全ファイルで共有される（名前を重ねない）。
- `test/`：`harness.mjs`（`index.html` が読む `js/` を vm とスタブで読み込む）、`baseline.test.mjs`・`app.test.mjs`、`baseline/`（判定結果の記録）。
- `LICENSE` / `THIRD_PARTY_NOTICES.md` / `README.md`：著作権表示、利用フォントの一覧、説明。
- 外部から読み込むのは Google Fonts だけ。ライブラリは使っていない。音は Web Audio API で合成している。

## コードの要点（js/）
- 音は `{l: 音名 0–6 (C–B), a: 変化 -2–2, o: オクターヴ}` で表す。異名同音を区別する。MIDI 番号は `midi()` で、全音階上の位置は `dia()` で得る。
- 課題は `"調 バス:数字 …"` という文字列で書く（例：`a  A2 C3:6 E3:+ A2`）。`parseExercise()` → `parseFig()` で和音の構成音・根音・第7音を求める。
- 規則は `js/theory.js` の `RULES` に一覧（id・名前・既定の重さ）を持ち、判定は同じファイルの `check()` で行う。規則を足すときはこの2か所を直す。
- 描画は `js/staff.js` の `drawStaff()`（SVG）、再生は `js/audio.js` の `playAll()` / `freqs()`（純正律の比は `JR`）。
- 保存は localStorage のキー `harmony-figured-bass-drill-v1`。形式を変えるときは移行の処理を書く。

## 設計方針
- 名前は「和声道場」、英語名は「Voice-Leading Dojo」。道場シリーズの一つ。
- 準拠する教程は林達也『新しい和声』。和音は数字付き低音で表す（芸大和声の記号は使わない）。
- 判定は「エラー／注意／オフ」を規則ごとに切り替える。模範解答は1つに決めない。
- 短調は自然短音階で読み、導音は「＋」で示す。「＋4」単独は 6/＋4/2、「＋6」単独は ＋6/3 とみなす（どちらも設定で変えられる）。
- 純正律は、和音ごとに根音を基準にした5限界の比で鳴らす。
- 例題6つは自作。教本の課題はアプリに収録しない（利用者が「課題を入力」で入れる）。
- 著作権は All rights reserved（著作権者 jun、2026年）。オープンソースのライセンスは付けない。
- localStorage のキー `harmony-figured-bass-drill-v1` は以前の実施を残すために変えない。

## 約束
- 画面の文言、コミットメッセージ、利用者への報告は日本語で書く。
- 色はすべて `:root` のトークンで指定し、ライトとダークの両方を保つ。幅 480px でも横にスクロールさせない。
- 画面下の著作権表示と LICENSE を消さない。新しいフォントや部品を足したら THIRD_PARTY_NOTICES.md に追記する。
- 教本の課題や譜例をアプリに収録しない。

## 確認
- JS の構文：`js/*.js` を `node --check` にかける。
- 判定：`node --test`（`test/baseline.test.mjs`）。`check()` の結果が `test/baseline/examples.json` の記録と同じことを確かめる。規則を意図して変えたときだけ `node test/baseline/generate.mjs` で記録を作り直す。
- 表示：幅 1280px と 480px でスクリーンショットを撮り、コンソールエラーと横スクロールがないことを確かめる。

## git
- コミットは日本語で1つにまとめる（1行目に要約、本文に箇条書き）。
- push は頼まれたときだけ行う。

## ブランチと公開(D25)
- 作業は `dev` ブランチで行う。`main` は公開中の版だけにする。`main` への取り込みと push は作者が頼んだときだけ。
- 公開のたびに版のタグ(`v1.3.0` など)を打つ。問題が出たら直前のタグに戻す。
- 保存データ(localStorage など)の移行は新しいキーに書き、古いキーは消さずに残す(古い版に戻しても壊れないように)。

## ドキュメント更新
- 作業の終わりに STATUS.md を上書き更新（50行以内、updated を更新）
- 完了した作業は PLAN.md から削除し、STATUS の「実装済み」に要約
- 外部素材を追加・削除したら THIRD_PARTY_NOTICES.md を更新
- OS・ブラウザ対応が変わったら STATUS の os: と対応状況を更新（未確認を「対応」と書かない）
- 詳細方針は道場シリーズ親フォルダの DOCS-POLICY.md を参照
