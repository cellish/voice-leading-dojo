# core の変更履歴

書法の部品(`DojoCore`)。版番号の上げ方は `../CLAUDE.md`。タグは `core-v<版>`(例 `core-v0.1.0`)。

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
| GR | 0.1.0 | node test/engine.test.js |
