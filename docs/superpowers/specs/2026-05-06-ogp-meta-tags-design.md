# OGP Meta Tags Design

- Date: 2026-05-06
- Scope: `web/index.html` への静的メタタグ追加 + 画像 1 枚の配置 + 検証テスト 1 ファイル
- Status: approved (brainstorm)

## 目的

X / Slack / Discord / Facebook などの SNS で本サイト URL を共有したとき、リッチプレビュー（タイトル・説明文・画像）が表示されるようにする。現状 `web/index.html` には `<title>` と viewport 以外の `<meta>` が無く、共有時の見た目が URL 文字列だけになっている。

## 非目的（YAGNI）

- 検索クエリ別 / フィルタ別 / 動画別の動的 OGP。SNS クローラは JS を実行しないため prerender か SSR が必要となり、本サイトの規模に対して過剰。共有対象は常にルート URL とみなす。
- favicon / Apple touch icon の追加。本タスクと直交する別課題。
- 構造化データ (`schema.org` / JSON-LD)。検索エンジン向けの最適化は本スコープ外。
- 画像の最適化・複数解像度・WebP 化。提供された 1 枚を運用する。
- `og:image` を build-time に動的生成する仕組み（テンプレート → PNG）。1 枚の固定画像で十分。
- スクレイパー / GitHub Actions ワークフロー / データスキーマへの変更。

## 設計概要

### アプローチ

完全に静的。ビルドプロセス・ランタイムロジックには手を入れない。

- 画像 `aimai_movie_stock.png`（リポジトリ直下、1536×1024、約 1MB PNG）を `web/public/aimai_movie_stock.png` に `git mv` で移動する。Vite は `web/public/*` をビルド時に `web/dist/` の root へそのままコピーするため、`vite.config.ts` の変更は不要。
- `web/index.html` の `<head>` に OGP / Twitter Card / `<meta name="description">` を直書きする。`og:url` と `og:image` はクローラ互換性のため絶対 URL でハードコードする（サイトの canonical URL は GitHub Pages デフォルトの `https://hitsumabushi845.github.io/aimai-x-movie-stock/` で固定）。
- `web/tests/index-html.test.ts` を新設し、必須メタタグの存在と `og:url` / `og:image` の値が想定する絶対 URL になっていることを検証する。これにより将来 `index.html` を編集した際にメタタグが消えるリグレッションを検知できる。

### メタタグの内容

```html
<!-- 一般 -->
<meta name="description" content="@official_aimai のライブダイジェスト等の動画一覧。X 投稿動画を一覧 / 検索 / 並び替えできる非公式ファンサイト。" />

<!-- Open Graph -->
<meta property="og:type" content="website" />
<meta property="og:site_name" content="aimai movie stock" />
<meta property="og:title" content="aimai movie stock" />
<meta property="og:description" content="@official_aimai のライブダイジェスト等の動画一覧。X 投稿動画を一覧 / 検索 / 並び替えできる非公式ファンサイト。" />
<meta property="og:url" content="https://hitsumabushi845.github.io/aimai-x-movie-stock/" />
<meta property="og:image" content="https://hitsumabushi845.github.io/aimai-x-movie-stock/aimai_movie_stock.png" />
<meta property="og:image:width" content="1536" />
<meta property="og:image:height" content="1024" />
<meta property="og:image:alt" content="aimai movie stock — Archive of videos from Oishii Aimai's Official X (Unofficial)" />
<meta property="og:locale" content="ja_JP" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
```

### 決定事項とその理由

- **`og:title` = "aimai movie stock"**: サイトタイトルそのまま。`<title>` と一致させてユーザの認識を揃える。
- **`og:description` / `<meta name="description">`**: サイトサブヘッダ "@official_aimai のライブダイジェスト等の動画一覧" を主軸に、サイトの主要機能（一覧 / 検索 / 並び替え）と "非公式ファンサイト" の前提を 1 文に集約。`og:description` と `<meta name="description">` は同文で兼用し、SEO の副次効果も得る。
- **`twitter:card` = `summary_large_image`**: 画像が 1536×1024 (3:2)。Twitter は `summary_large_image` を 1.91:1 でクロップするため上下が約 110px ずつ削られるが、提供画像は文字が垂直中央寄せで上下に十分な余白があり、視覚的に問題なく収まる範囲。`summary` （正方形小サムネ）を選ぶと banner 画像が極端に縮小されてテキストが読めなくなるため不採用。
- **`twitter:site` / `twitter:creator` は付けない**: 本サイト自身の X アカウントは存在せず、`@official_aimai` を creator として付けるのは README で明示している "非公式ファンサイト" の前提と矛盾しミスリードになりうる。
- **`og:locale` = `ja_JP`**: `<html lang="ja">` と整合させる。
- **絶対 URL**: Vite は `base: "./"` で相対パス運用しているが、SNS クローラはどこから fetch するか分からず相対 URL の解釈が不安定。`og:url` / `og:image` はサイトの canonical 絶対 URL でハードコードする。
- **画像最適化はしない**: 1MB PNG は Twitter (5MB) / Facebook の上限内に収まる。SNS クローラは初回取得後にキャッシュするため、エンドユーザの体感速度に影響しない。最適化を入れると画像生成パイプラインが必要になり scope が広がる。

## ファイル変更

| ファイル                                | 種別 | 変更内容                                                                  |
| --------------------------------------- | ---- | ------------------------------------------------------------------------- |
| `aimai_movie_stock.png`                 | 削除 | リポジトリ直下から `web/public/` へ `git mv` で移動                       |
| `web/public/aimai_movie_stock.png`      | 新規 | 上記移動先（中身は既存の 1536×1024 PNG をそのまま）                       |
| `web/index.html`                        | 編集 | `<head>` 内に description / OGP / Twitter Card メタタグを追加             |
| `web/tests/index-html.test.ts`          | 新規 | `web/index.html` をパースし、必須メタタグの存在と URL 値を assert         |
| `web/src/*`                             | 無変更 | ランタイムコードは触らない                                              |
| `web/vite.config.ts`                    | 無変更 | `public/` 慣習に乗るためビルド設定は不要                                |
| `.github/workflows/*.yml`               | 無変更 | 既存の deploy.yml が `web/dist/` をそのまま Pages にアップロードするだけ |
| `data/`, `scraper/`, `schema/`          | 無変更 |                                                                           |

## エラーハンドリング / フォールバック

- 一部のチャットツール（Slack 等）は `og:image` を絶対 URL でしか解決しない。本設計は絶対 URL でハードコードしているため対応済み。
- 一部クローラは `og:image:width` / `og:image:height` が無いとプレビューを保留することがある。本設計はサイズを明示している。
- 画像取得失敗時はクローラ側でテキストのみのプレビューにフォールバックする（OGP の標準挙動）。アプリ側で追加のフォールバックは不要。

## 検証

### 自動

- `web/tests/index-html.test.ts`（新規）: `vitest` で実行。`index.html` を `fs.readFileSync` で読み、文字列マッチまたは軽量 DOM パースで以下を確認する。
  - `<meta name="description">` が存在し、空でない `content` を持つ。
  - `<meta property="og:title">` / `og:description` / `og:url` / `og:image` / `og:type` / `og:site_name` / `og:locale` が存在する。
  - `og:url` の `content` が `https://hitsumabushi845.github.io/aimai-x-movie-stock/` と完全一致する。
  - `og:image` の `content` が `https://hitsumabushi845.github.io/aimai-x-movie-stock/aimai_movie_stock.png` と完全一致する。
  - `<meta name="twitter:card">` の `content` が `summary_large_image` である。
  - `og:image:width` / `og:image:height` が `1536` / `1024` である。
- `make test` で既存の `data.test.ts` / `render.test.ts` / `search.test.ts` も含めグリーン継続。

### 手動

| 確認項目                                                                       | 期待                                                                       |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `pnpm build` 後、`web/dist/aimai_movie_stock.png` が存在する                   | 1536×1024 PNG がそのまま配置される                                         |
| `pnpm build` 後、`web/dist/index.html` の `<head>` に追加メタタグが含まれる    | OGP / Twitter Card 全項目                                                  |
| `make web-dev` で `http://localhost:5173/aimai_movie_stock.png` が 200 を返す  | dev server からも画像にアクセス可能                                        |

### デプロイ後

- 本番デプロイ後、以下のいずれかでプレビューを確認する。SNS 各社のクローラはキャッシュするため、初回確認時に意図通りのプレビューになっていることが重要。
  - X (Twitter) の Card Validator / Post Composer プレビュー
  - Facebook Sharing Debugger（`https://developers.facebook.com/tools/debug/`）
  - Slack / Discord に貼り付け（unfurl 表示）
- 強制再キャッシュが必要な場合は Facebook Sharing Debugger の "Scrape Again" を使う。

## ロールバック

- `web/index.html` の差分と `web/tests/index-html.test.ts` の削除、画像の `web/public/` → リポジトリ直下への戻しの 3 点で完結。`git revert` 1 コミットで元に戻る。
- 既デプロイ済みの場合、SNS 側のキャッシュは 7〜30 日程度残ることがあるが、URL ベースで再フェッチを促せば更新される。

## オープン項目

- なし。
