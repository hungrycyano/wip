# WIP（Work In Progress）

書きかけの文章（短文・散文・詩など）を、公開しながら直していくための個人サイトです。
Astro で作った静的サイトを、GitHub Pages で公開します。

- 公開URL：<https://hungrycyano.github.io/wip/>
- サイト名・説明文：`src/config/site.json`
- 作品の種類（短文・詩など）：`src/config/kinds.json`

---

## 作品を追加する

1. `src/works/` に `作品ID.md` という名前でファイルを作ります。
   作品ID は半角英数字とハイフン（例：`asa-no-koppu.md`）。これがURLになります（`/wip/works/asa-no-koppu/`）。
2. ファイルの先頭に、次の情報を書きます。

```yaml
---
title: 作品名
summary: 一覧に出す短い説明（1〜2文）
kind: short        # src/config/kinds.json の id のどれか
status: 書きかけ    # 書きかけ / 改稿中 / ひとまず完成
tags: [夜, 海]
created: 2026-10-18
updated: 2026-10-18 # 一覧はこの日付の新しい順。手で書いた日付がそのまま出ます
thumbnail: /assets/作品ID/thumb.jpg   # 省略可
background: /assets/作品ID/bg.jpg     # 省略可
audio: /assets/作品ID/reading.mp3     # 省略可
draft: false       # true にすると公開サイトに出ません
log:               # 直した履歴の一言メモ（新しいものを上に）
  - date: 2026-10-18
    note: 3段落目を削った
---

ここから本文（Markdown）。
空行で段落が分かれます。
```

- `status` と `kind` に決まっていない値を書くと、ビルドがエラーになり、どの作品のどこが違うかが表示されます。
- 詩（`kinds.json` で `"keepLineBreaks": true` の種類）は、行末の改行がそのまま表示されます。ほかの種類では、空行で段落が分かれ、段落の中の改行はつながります。
- 画像・音声は `public/assets/作品ID/` に置き、先頭情報には `/assets/作品ID/ファイル名` と書きます（`/wip` は自動で付きます）。
  音声ファイルは 1ファイル100MB未満、サイト全体で1GB程度までを目安にしてください。

### テスト用の作品

`src/works/test-short.md`・`test-poem.md`・`test-prose.md` は動作確認用です。本物の作品を置いたら、`test-` で始まるファイルは削除してかまいません（元のひな形は `sample/` に残っています）。

## 種類（kind）を増やす・減らす

`src/config/kinds.json` だけを直します。

```json
{ "id": "essay", "label": "随筆" }
```

- 追加：1行足すだけ。トップの絞り込みや作品の検証に自動で反映されます。
- 表示名を変える：`label` だけ直します（作品ファイルは直さなくてよい）。
- 削除：1行消すだけ。ただし、その種類を使っている作品があるとビルドエラーになり、該当する作品の名前が表示されます。
- 改行をそのまま表示したい種類には `"keepLineBreaks": true` を付けます。

## 公開する

`main` ブランチに変更が入ると、GitHub Actions が自動でビルドして GitHub Pages に公開します（数分かかります）。
進み具合は、GitHub のリポジトリの「Actions」タブで見られます。

### 最初に1回だけ必要な設定

1. GitHub のリポジトリ → **Settings** → **Pages**
2. 「Build and deployment」の **Source** を **GitHub Actions** にする

### GitHub の画面だけで作品を追加・修正する

1. リポジトリの `src/works/` を開く
2. 「Add file」→「Upload files」で、書き出した `.md` ファイルを置く（同じ名前なら上書き）
3. 「Commit changes」を押す → 数分後に公開サイトに反映

### リポジトリ名を変えたとき

`astro.config.mjs` の `base`（今は `/wip`）を、新しいリポジトリ名に合わせて直してください。

## パソコンで動かしてみる（任意）

Node.js 22 以上が必要です。

```sh
npm install
npm run dev      # http://localhost:4321/wip/ で確認（検索はビルド後のみ）
npm run build    # 公開用のファイルを dist/ に作る（検索の索引も作る）
npm run preview  # ビルドしたものを確認
```

## 表示設定について

縦書き／横書き、文字の大きさ、行間、1行の文字数は、読む人のブラウザに保存され、次に開いたときも引き継がれます。
1行の文字数を画面に収まらない値にしたときは、画面いっぱいで止まります（設定欄に「画面いっぱい：約○字」と出ます）。

## ファイルの構成

```
src/
  config/site.json     サイト名・説明
  config/kinds.json    作品の種類
  works/*.md           作品（1作品＝1ファイル）
  content.config.ts    作品の先頭情報の決まり（検証）
  lib/render.ts        本文の表示（公開ページと、今後の編集画面プレビューで共通）
  lib/parts.ts         状態ラベル・更新メモなどの表示部品
  styles/wip.css       見た目（すべての画面で共通）
  scripts/             表示設定・位置スライダー・検索の動き
  pages/               ページ（トップ・作品ページ）
public/assets/         公開する画像・音声
sample/                テスト用作品と種類設定のひな形
```
