---
app: 和声道場(Voice-Leading Dojo)
stage: 試作          # 構想 / 試作 / 公開中 / 保守
url:                 # 未公開。GitHub Pages は無効(2026-11-26 確認)。有効にすると https://cellish.github.io/voice-leading-dojo/
updated: 2026-11-28
os:                  # 対応 / 一部制限 / 非対応 / 未確認
  macos: 未確認
  ios: 未確認        # iPadOS を含む
  windows: 未確認
  android: 未確認
---
## 実装済み（要約）
- 数字付き低音のバスに上3声を書き、禁則をその場で判定する練習アプリ(`index.html`・`css/`・`js/` に分けてある。ビルドなし)
- 17項目の規則(連続5度・8度、声部の交差・超越、導音・第7音の解決など)を、規則ごとに「エラー／注意／オフ」で切り替え
- 全体または1和音を、平均律と純正律で鳴らし比べる(Web Audio で合成)
- 自作の例題6つ、課題の入力(`"調 バス:数字 …"` の文字列)、実施と設定の localStorage 保存
- 計算部を `js/theory.js`、見た目を `css/style.css`、その他を `js/` の4ファイルに分けた(動きは同じ。1280/480px のスクリーンショットが分ける前と一致。D08・段階2の前半)
- 音名・調の計算と、声部対の規則6つ（音域・交差・連続5度8度・反行・並達・跳躍）の判定を書法コア core 0.5.0（`vendor/dojo-shared/core/`、ruleset `tonal-4v`）に置き換えた（段階2・3）
- 判定の修正（段階3b、2026-11-28）: 同度の並行は「連続1度（同度）」、外声の5度→8度・8度→5度も並達、`augMel` を増2度・増4度・増5度と解決しない減5度に（バスは課題の読み込みで知らせる）。変わった判定は `test/baseline/CHANGES-3b.md`（作者が確認済み）
- `check()` の判定結果の記録と回帰テスト(`test/`、`node --test`。例題6つ×7通り+手作りの解答4つで全17規則が出る。段階2の前の基準)
- 保存データの読み込みで、保存に無い規則は既定の重さになる(`load()` を直した。判定は変わらない。D27 の (c))
- 著作権表示(All rights reserved、LICENSE、THIRD_PARTY_NOTICES.md、画面下)
- GitHub `cellish/voice-leading-dojo`(公開)に push 済み。claude.ai のアーティファクト版(旧名「数字付き低音ドリル」)は古いまま

## 現在の検討事項（主要3件まで）
- 教本の章ごとの規則(利用者があとで入力する)を `RULES` と `check()` に反映する
- 「＋4」「＋6」の既定値を教本の扱いに合わせる
- 書法コア: docs/INVENTORY.md の共通部品の検討

## 次の一手（1〜2件）
- GitHub Pages を有効にする(設定は利用者が行う。main / root)
- 教本の章ごとの規則の反映

## 共通部品の状況
- 音名・音高・調の計算(`midi`・`same`・`nName`・`parseNote`・`makeKey`・`parseKey`): 共通化済み(core 0.5.0。`js/theory.js` は薄い包み)
- 楽譜の描画(SVG 手描き `drawStaff`): 独自実装
- 禁則の判定(`RULES`・`check()`): 声部対の6規則は共通化済み(core の `judge`、ruleset `tonal-4v`)。ほかの11規則は独自実装
- 音の再生(平均律・純正律の合成): 独自実装
- 数字付き低音の解析(`parseExercise`・`parseFig`): 独自実装
## OS / ブラウザ対応状況
- macOS: Chrome 未確認 / Safari 未確認(確認手順は CLAUDE.md にあるが、確認した記録がない)
- iOS / iPadOS: 未確認(幅 480px の確認手順はあるが、実機の記録なし。MIDI・マイクは使わない)
- Windows: Chrome 未確認
- Android: Chrome 未確認
