# 和声道場（Voice-Leading Dojo）

数字付き低音のバスに上3声を書き、禁則をその場で確かめ、平均律と純正律で鳴らし比べる練習アプリです。数字の表記は林達也『新しい和声』に合わせています。道場シリーズの一つです。

公開サイト：https://cellish.github.io/voice-leading-dojo/

## できること

- バスと数字から上3声（S・A・T）を譜表に入力する（クリックまたはキーボード）
- 連続5度・8度、声部の交差・超越、導音や第7音の解決など17項目を入力のたびに判定する。規則ごとに「エラー／注意／オフ」を選べる
- 全体または1和音を、平均律と純正律で鳴らし比べる
- 自分で課題を入力する（例：`a  A2 C3:6 D3:6 E3:+ A2`）
- 実施と設定はブラウザ内（localStorage、キー `harmony-figured-bass-drill-v1`）に保存し、外部へは送らない

## 使い方

`index.html` をブラウザで開くだけで動きます。ビルドは不要です。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | アプリ本体（HTML・CSS・JavaScript を1ファイルにまとめたもの） |
| `README.md` | この説明 |
| `LICENSE` | 著作権表示と利用条件 |
| `THIRD_PARTY_NOTICES.md` | 利用している他者の著作物（フォント）の一覧 |

## 著作権・ライセンス

Copyright (c) 2026 jun. All rights reserved.

ライセンスは [`LICENSE`](LICENSE)、同梱・利用している他者の著作物(フォント)と、収録している例題の扱いは [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) を参照してください。
