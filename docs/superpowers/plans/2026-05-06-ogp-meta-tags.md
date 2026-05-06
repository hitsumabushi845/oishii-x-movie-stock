# OGP Meta Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SNS で本サイト URL を共有したときにリッチプレビュー（タイトル・説明・画像）が表示されるよう、`web/index.html` に OGP / Twitter Card メタタグを追加し、共有用 PNG をビルド成果物に含める。

**Architecture:** 完全に静的。画像 1 枚 (`aimai_movie_stock.png`) を `web/public/` に置いて Vite の標準コピー機構に乗せ、`web/index.html` の `<head>` に OGP / Twitter Card / `<meta name="description">` を直書きする。`og:url` / `og:image` は GitHub Pages 上の canonical 絶対 URL でハードコード。`web/tests/index-html.test.ts` でメタタグ存在のリグレッションを検知。

**Tech Stack:** Vite 5 + TypeScript（既存）、vitest + happy-dom（既存テスト環境）。新規依存なし。

**Spec:** [`docs/superpowers/specs/2026-05-06-ogp-meta-tags-design.md`](../specs/2026-05-06-ogp-meta-tags-design.md)

**Branch:** `feat/ogp-meta-tags`（spec commit 済み）

---

## ファイル構成

| パス                                    | 役割                                                                |
| --------------------------------------- | ------------------------------------------------------------------- |
| `web/public/aimai_movie_stock.png`      | OGP 画像。Vite が `web/dist/aimai_movie_stock.png` にコピー         |
| `web/index.html`                        | `<head>` に OGP / Twitter Card / description メタタグを追加         |
| `web/tests/index-html.test.ts`          | `web/index.html` をパースしてメタタグの存在と URL を assert         |

`web/src/*` / `web/vite.config.ts` / `.github/workflows/*` / `data/` / `scraper/` / `schema/` は無変更。

---

## Task 1: OGP 画像を `web/public/` に配置する

**Files:**
- Move: `aimai_movie_stock.png` → `web/public/aimai_movie_stock.png`

リポジトリ直下に置かれている画像（1536×1024、約 1MB PNG、untracked）を Vite が自動的に dist にコピーする `web/public/` に移す。

- [ ] **Step 1: 画像が存在することを確認**

Run:
```bash
ls -la aimai_movie_stock.png
```
Expected: `aimai_movie_stock.png` がリポジトリ直下に存在し、約 1MB の PNG。

- [ ] **Step 2: `web/public/` ディレクトリを作成**

Run:
```bash
mkdir -p web/public
```
Expected: 既存なら no-op、なければ作成。

- [ ] **Step 3: 画像を移動**

Run:
```bash
mv aimai_movie_stock.png web/public/aimai_movie_stock.png
```
Expected: コマンド成功、戻り値 0。`aimai_movie_stock.png` がリポジトリ直下から消え、`web/public/aimai_movie_stock.png` に出現する。

- [ ] **Step 4: 移動結果を確認**

Run:
```bash
ls -la web/public/aimai_movie_stock.png && ls aimai_movie_stock.png 2>&1 || echo "(removed from root, OK)"
```
Expected: `web/public/aimai_movie_stock.png` が存在。リポ直下の方は `No such file or directory` か `(removed from root, OK)` のいずれか。

- [ ] **Step 5: ビルドして dist に画像が含まれるか確認**

Run:
```bash
cd web && pnpm install --frozen-lockfile && pnpm build && ls dist/aimai_movie_stock.png
```
Expected: ビルド成功（exit 0）、`web/dist/aimai_movie_stock.png` が存在し 1MB 程度。

- [ ] **Step 6: コミット**

Run:
```bash
git add web/public/aimai_movie_stock.png
git commit -m "$(cat <<'EOF'
feat(web): add OGP share image to public assets

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```
Expected: 1 ファイル新規（PNG）の commit が作成される。

---

## Task 2: メタタグ存在を検証する失敗テストを書く

**Files:**
- Create: `web/tests/index-html.test.ts`

`web/index.html` を読み込んで happy-dom でパースし、必須メタタグの存在と URL 値を assert するテストを書く。先にテストを書き、`index.html` 未編集の状態で必ず fail することを確認する（赤）。

- [ ] **Step 1: 失敗テストを書く**

Create `web/tests/index-html.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { Window } from "happy-dom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(
  path.join(__dirname, "..", "index.html"),
  "utf-8",
);

const SITE_URL = "https://hitsumabushi845.github.io/aimai-x-movie-stock/";
const IMAGE_URL = `${SITE_URL}aimai_movie_stock.png`;
const DESCRIPTION =
  "@official_aimai のライブダイジェスト等の動画一覧。X 投稿動画を一覧 / 検索 / 並び替えできる非公式ファンサイト。";

function parseHead(): Document {
  const window = new Window();
  window.document.write(html);
  return window.document as unknown as Document;
}

function metaContent(
  doc: Document,
  attr: "name" | "property",
  key: string,
): string | null {
  const el = doc.querySelector(`meta[${attr}="${key}"]`);
  return el ? el.getAttribute("content") : null;
}

describe("index.html metadata", () => {
  let doc: Document;
  beforeAll(() => {
    doc = parseHead();
  });

  it("has a non-empty meta description", () => {
    expect(metaContent(doc, "name", "description")).toBe(DESCRIPTION);
  });

  it("has og:type = website", () => {
    expect(metaContent(doc, "property", "og:type")).toBe("website");
  });

  it("has og:site_name", () => {
    expect(metaContent(doc, "property", "og:site_name")).toBe(
      "aimai movie stock",
    );
  });

  it("has og:title matching the page title", () => {
    expect(metaContent(doc, "property", "og:title")).toBe("aimai movie stock");
  });

  it("has og:description", () => {
    expect(metaContent(doc, "property", "og:description")).toBe(DESCRIPTION);
  });

  it("has og:url as canonical absolute URL", () => {
    expect(metaContent(doc, "property", "og:url")).toBe(SITE_URL);
  });

  it("has og:image as absolute URL pointing to the share PNG", () => {
    expect(metaContent(doc, "property", "og:image")).toBe(IMAGE_URL);
  });

  it("declares og:image dimensions matching the source PNG", () => {
    expect(metaContent(doc, "property", "og:image:width")).toBe("1536");
    expect(metaContent(doc, "property", "og:image:height")).toBe("1024");
  });

  it("has a non-empty og:image:alt", () => {
    const alt = metaContent(doc, "property", "og:image:alt");
    expect(alt).toBeTruthy();
    expect(alt!.length).toBeGreaterThan(10);
  });

  it("has og:locale = ja_JP", () => {
    expect(metaContent(doc, "property", "og:locale")).toBe("ja_JP");
  });

  it("uses summary_large_image for the Twitter card", () => {
    expect(metaContent(doc, "name", "twitter:card")).toBe(
      "summary_large_image",
    );
  });
});
```

Expected: ファイルが作成される。型エラーは出ない（happy-dom と node:fs / url / path はすべて既存依存）。

- [ ] **Step 2: テストを実行して失敗することを確認**

Run:
```bash
cd web && pnpm exec vitest run index-html
```
Expected: `index-html.test.ts` の全アサーションが失敗。理由: 現在の `web/index.html` には description / OGP / Twitter Card が無いため `metaContent` が `null` を返し、各 `toBe(...)` が `null !== <expected>` で失敗する。`tests/index-html.test.ts (11)` などのカウントで複数 fail が表示される。既存の他テスト（`data.test.ts` / `render.test.ts` / `search.test.ts`）は影響なく pass。

---

## Task 3: `web/index.html` にメタタグを追加してテストを通す

**Files:**
- Modify: `web/index.html`（`<head>` 内、`<title>` の直後にメタタグブロックを挿入）

Task 2 のテストが green になる最小実装。

- [ ] **Step 1: `web/index.html` の `<head>` を編集**

`web/index.html` の現状:

```html
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>aimai movie stock</title>
  <link rel="stylesheet" href="/src/styles.css" />
</head>
```

`<title>` の直後、`<link rel="stylesheet" ...>` の前に以下のブロックを挿入する。最終的な `<head>` の中身:

```html
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>aimai movie stock</title>

  <meta name="description" content="@official_aimai のライブダイジェスト等の動画一覧。X 投稿動画を一覧 / 検索 / 並び替えできる非公式ファンサイト。" />

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

  <meta name="twitter:card" content="summary_large_image" />

  <link rel="stylesheet" href="/src/styles.css" />
</head>
```

注意点:
- `og:title` / `og:description` の文字列はテストの定数 `DESCRIPTION` と完全一致させる（全角スペース・記号も含めて）。
- `og:url` 末尾のスラッシュは必須（テストは `https://hitsumabushi845.github.io/aimai-x-movie-stock/` で完全一致を見る）。
- `<body>` 以下と既存の他要素は触らない。

- [ ] **Step 2: テストを実行して通ることを確認**

Run:
```bash
cd web && pnpm exec vitest run index-html
```
Expected: `index-html.test.ts` の 11 アサーションすべて pass。

- [ ] **Step 3: 既存テストもまとめて実行して回帰がないことを確認**

Run:
```bash
cd web && pnpm test
```
Expected: 全テスト（`data.test.ts` / `render.test.ts` / `search.test.ts` / `index-html.test.ts`）pass。

- [ ] **Step 4: TypeScript 型チェック + ビルドが通ることを確認**

Run:
```bash
cd web && pnpm build
```
Expected: `tsc --noEmit` が通り、`vite build` が成功し、`web/dist/index.html` と `web/dist/aimai_movie_stock.png` が生成される。

- [ ] **Step 5: ビルド成果物の `<head>` にメタタグが含まれていることを確認**

Run:
```bash
grep -E '(og:title|og:image|twitter:card|og:url)' web/dist/index.html
```
Expected: 4 行以上ヒット。Vite は `<meta>` をそのまま素通しするので、ソースと同じ内容が dist に出力されている。

- [ ] **Step 6: コミット**

Run:
```bash
git add web/index.html web/tests/index-html.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add OGP and Twitter Card meta tags

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```
Expected: 2 ファイル変更（index.html 修正 + テスト新規）の commit が作成される。

---

## Task 4: 統合確認（手動）と PR 作成準備

**Files:** なし（検証のみ）

ローカル dev server とビルド成果物で実際に画像とメタタグが配信できているか確認する。本番デプロイ後の SNS プレビュー確認手順を PR description にメモする。

- [ ] **Step 1: dev server で画像にアクセスできるか確認**

Terminal A:
```bash
cd web && pnpm dev
```
Terminal B:
```bash
curl -sI http://localhost:5173/aimai_movie_stock.png | head -1
```
Expected: `HTTP/1.1 200 OK`（または同等の 200）。

確認後、Terminal A の dev server を `Ctrl-C` で止める。

- [ ] **Step 2: dev server から `index.html` のメタタグが配信されているか確認**

Terminal A で再度 `cd web && pnpm dev`。
Terminal B:
```bash
curl -s http://localhost:5173/ | grep -E '(og:title|og:image|twitter:card)' | head
```
Expected: OGP / Twitter Card のメタ行が出力される。

確認後、Terminal A を停止。

- [ ] **Step 3: PR を作成する（ユーザに任せる選択肢）**

このタスクの run-time は plan 実行者が PR を作るかどうかの決定権を持たないため、ここでは PR 作成自体は行わない。代わりに、PR description 用の手動検証チェックリストを README コミットや PR テンプレートにそのまま貼れる形でまとめておく:

```markdown
## Manual verification (post-deploy)

- [ ] X (Twitter) Post Composer に `https://hitsumabushi845.github.io/aimai-x-movie-stock/` を貼り、`summary_large_image` プレビューでバナー画像とタイトルが表示されることを確認
- [ ] Facebook Sharing Debugger (https://developers.facebook.com/tools/debug/) に同 URL を入れて "Scrape Again"。タイトル / 説明 / 画像が正しく取得されることを確認
- [ ] Slack / Discord に URL を貼って unfurl が出ることを確認
```

このチェックリストは PR description に含める前提で plan として明示しておく。実際の検証はマージ後に GitHub Pages へのデプロイが完了してから行う（GitHub Pages の URL に対して SNS クローラがアクセスできる必要があるため、ローカルでは実施不可）。

- [ ] **Step 4: ブランチ全体の状態を最終確認**

Run:
```bash
git log --oneline main..HEAD
git status
```
Expected: `main` から進んだコミットが 3 本（spec / 画像追加 / メタタグ＋テスト）。working tree clean。

---

## 完了基準

- `feat/ogp-meta-tags` ブランチに以下の 3 commit が並んでいる:
  1. `docs: add OGP meta tags design`（既存、Task 0）
  2. `feat(web): add OGP share image to public assets`（Task 1）
  3. `feat(web): add OGP and Twitter Card meta tags`（Task 3）
- `cd web && pnpm test` 全 pass。
- `cd web && pnpm build` 成功し、`web/dist/aimai_movie_stock.png` と `<head>` 内 OGP/Twitter タグを含む `web/dist/index.html` が生成される。
- PR を立てる場合、Task 4 Step 3 の手動検証チェックリストを description に含める。
