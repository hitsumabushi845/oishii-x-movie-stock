# Multi-Group Tabs Design (OISHII Movie Stock)

- Date: 2026-05-06
- Scope: 単一アカウント（`@official_aimai`）前提のサイトを OISHII.inc 配下 3 グループ対応にスケールさせる。データ構造・スクレイパー・GitHub Actions・フロントエンド UI / テーマ・OGP まで横断的に改修する。
- Status: approved (brainstorm)

## 目的

OISHII.inc 配下 3 グループの公式 X が投稿した動画を、1 つの静的サイトでタブ切替で閲覧できるようにする。対象アカウントとブランドカラー:

| Slug       | グループ名       | X ハンドル          | テーマ色   |
| ---------- | ---------------- | ------------------- | ---------- |
| `aimai`    | 美味しい曖昧     | `official_aimai`    | `#bc2956`  |
| `shokuzai` | 美味しい贖罪     | `ofc_shokuzai`      | `#1A1A1A`  |
| `mizutama` | 美味しい水玉     | `oishii_mizutama`   | `#6CAAEF`  |

サイト全体は OISHII.inc 横断にリブランドし、タイトルは「OISHII Movie Stock」とする。タブで active グループを切り替えると、見出し・外部リンク先・テーマアクセント色がそのグループの値に切り替わる。検索 / フィルタ / ソートの状態はタブ切替で維持され、active グループのデータに対して適用される。タブ状態は URL クエリ `?g=<slug>` に同期し、SNS で「水玉のページ」を直リンクで共有できる。

## 非目的（YAGNI）

- **タブ別 OGP**: `/aimai/`, `/shokuzai/`, `/mizutama/` のような multi-page 出力 / 静的 prerender。`?g=` はクエリパラメータなので OGP クローラはほぼ無視する。本タスクでは OGP はサイト共通（OISHII Movie Stock 横断版）に統一する。
- **クロスグループ横断検索**: タブを「ビュー切替」ではなく「フィルタ」として扱い 3 グループを 1 リストで横断検索する UX は別機能とみなす。
- **動的グループ追加 UI**: 4 グループ目以降をマニフェスト編集なしで追加できる管理画面。
- **per-group の OGP 画像生成パイプライン**: 自動レンダリング・テンプレートからの PNG 生成。
- **タブ並び替え / ピン留め / 隠す**などのユーザー操作。順序は manifest 固定。
- **既存 OGP 画像の作り直し** はユーザー側で別途行う想定（design doc 内に asset TODO として明記）。

## 設計概要

### アーキテクチャ

```
data/
├── groups.json            ← 新規・タブ定義の single source of truth
├── aimai.json             ← 旧 videos.json をリネーム
├── shokuzai.json          ← 新規（バックフィル後に生成）
└── mizutama.json          ← 新規（バックフィル後に生成）

schema/
├── groups.schema.json     ← 新規・マニフェスト用スキーマ
└── videos.schema.json     ← 既存・全グループの per-group ファイルで再利用
```

per-group の videos ファイルは既存の `VideosFile` スキーマ（`generated_at` / `last_synced_at` / `source_query` / `videos`）をそのまま再利用する。中身の構造は変わらないため、グループ識別はファイル名でのみ行う（`source_query` フィールドにそのグループのクエリ文字列が入るので人間がファイル単体を見ても判別できる）。

`data/groups.json` をマニフェストとして導入し、グループ定義（slug / 表示名 / X ハンドル / テーマ色 / per-group ファイルのファイル名）の **single source of truth** とする。スクレイパー・GitHub Actions・フロントエンドはすべてここを参照することで、新規グループ追加時の修正箇所を 1 ファイルに集約する。

### マニフェスト `data/groups.json`

```json
{
  "$schema": "../schema/groups.schema.json",
  "groups": [
    {
      "slug": "aimai",
      "display_name": "美味しい曖昧",
      "x_handle": "official_aimai",
      "data_file": "aimai.json",
      "color": "#bc2956"
    },
    {
      "slug": "shokuzai",
      "display_name": "美味しい贖罪",
      "x_handle": "ofc_shokuzai",
      "data_file": "shokuzai.json",
      "color": "#1A1A1A",
      "color_dark": "#f7f9f9"
    },
    {
      "slug": "mizutama",
      "display_name": "美味しい水玉",
      "x_handle": "oishii_mizutama",
      "data_file": "mizutama.json",
      "color": "#6CAAEF"
    }
  ]
}
```

- `slug`: URL `?g=` の値および CSS / JS のキー。`^[a-z][a-z0-9_-]*$`。
- `data_file`: `data/` ディレクトリ起点の相対ファイル名。
- `color`: HEX。タブ active 表示・再生ボタン open 時・ヘッダーリンクに適用される。
- `color_dark`: オプショナル。指定時はダークテーマ時のみこちらを使う。`#1A1A1A`（shokuzai）はダーク背景に埋もれるため、`color_dark: "#f7f9f9"`（≒ `--fg`）でフォールバック。
- 配列の順序がそのままタブの並び順。

### スキーマ `schema/groups.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "GroupsManifest",
  "type": "object",
  "required": ["groups"],
  "additionalProperties": false,
  "properties": {
    "$schema": { "type": "string" },
    "groups": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/group" }
    }
  },
  "$defs": {
    "group": {
      "type": "object",
      "required": ["slug", "display_name", "x_handle", "data_file", "color"],
      "additionalProperties": false,
      "properties": {
        "slug":         { "type": "string", "pattern": "^[a-z][a-z0-9_-]*$" },
        "display_name": { "type": "string", "minLength": 1 },
        "x_handle":     { "type": "string", "pattern": "^[A-Za-z0-9_]{1,15}$" },
        "data_file":    { "type": "string", "pattern": "^[A-Za-z0-9_.-]+\\.json$" },
        "color":        { "type": "string", "pattern": "^#[0-9A-Fa-f]{6}$" },
        "color_dark":   { "type": "string", "pattern": "^#[0-9A-Fa-f]{6}$" }
      }
    }
  }
}
```

`slug` の重複は実装側（scraper / web）でロード時に検証する（JSON Schema では表現しづらいため）。

### スクレイパー変更

CLI に `--group <slug>` と `--manifest <path>` を追加。マニフェストから `x_handle` / `data_file` を解決して、クエリ `from:{handle} has:videos -is:retweet` を組み立てる。

```bash
# 1 グループ実行
uv run python -m scraper --group aimai \
  --manifest ../data/groups.json \
  --schema ../schema/videos.schema.json

# 全グループを順次実行（ローカル便利機能、CI では使わない）
uv run python -m scraper --all \
  --manifest ../data/groups.json \
  --schema ../schema/videos.schema.json
```

- 既存の `--query` / `--data-file` は legacy モードとして残す（両方とも明示指定された場合のみ動作、manifest 解決をバイパス）。`--group` または `--all` と `--query` / `--data-file` の併用はエラーで早期終了する。`--manifest` は `--group` / `--all` 使用時のみ必須。
- `--backfill` / `--require-existing` / `--dry-run` / `--summary-out` の挙動はグループごとに独立して機能する。
- `--all` は内部的に各グループに対して逐次 `run()` を実行し、1 グループの失敗が他のグループに伝播しない（exit code は失敗グループ数に応じて非ゼロ）。各グループの結果はそれぞれ `--summary-out` の同一ファイルに `### scraper summary [<slug>]` セクションとして追記する。
- マニフェストロードは新規 `scraper/src/scraper/groups.py` に実装する（pydantic + jsonschema 両方で検証）。

### GitHub Actions (`update-data.yml`) 変更

3 グループを matrix で並行スクレイプ → 結果を集約して **1 つの PR** にまとめる構成にする。

```yaml
jobs:
  scrape:
    strategy:
      fail-fast: false
      matrix:
        group: [aimai, shokuzai, mizutama]
    steps:
      - uses: actions/checkout@…
      - uses: astral-sh/setup-uv@…
      - run: cd scraper && uv sync --frozen
      - name: Run scraper for ${{ matrix.group }}
        env:
          X_BEARER_TOKEN: ${{ secrets.X_BEARER_TOKEN }}
        run: |
          cd scraper && uv run python -m scraper \
            --group ${{ matrix.group }} \
            --manifest ../data/groups.json \
            --schema ../schema/videos.schema.json \
            --require-existing \
            --summary-out "$GITHUB_STEP_SUMMARY"
      - uses: actions/upload-artifact@…
        with:
          name: data-${{ matrix.group }}
          path: data/${{ matrix.group }}.json

  open-pr:
    needs: scrape
    if: always()
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@…
      - uses: actions/download-artifact@…  # 全 artifact を ./_artifacts に
      - name: Stage updated files
        run: |
          for f in _artifacts/data-*/*.json; do cp "$f" data/; done
      - name: Detect changes
        id: diff
        run: |
          if git diff --quiet -- data/; then
            echo "changed=false" >> "$GITHUB_OUTPUT"
          else
            echo "changed=true" >> "$GITHUB_OUTPUT"
          fi
      - name: Create Pull Request
        if: steps.diff.outputs.changed == 'true'
        uses: peter-evans/create-pull-request@…
        with:
          commit-message: "chore(data): update per-group videos.json"
          title: "chore(data): weekly per-group videos.json update"
          branch: bot/update-data
          delete-branch: true
          add-paths: data/*.json
      - name: Notify Slack on failure
        if: failure()
        uses: slackapi/slack-github-action@…
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          SLACK_WEBHOOK_TYPE: INCOMING_WEBHOOK
```

- `fail-fast: false`: 1 グループの API エラーで他のグループ更新を巻き込まない。
- 1 グループだけ更新成功した場合でも、その差分は PR に含まれる。
- `if: always()`（open-pr ジョブ）で scrape ジョブが部分失敗していても残った差分は PR にできる。
- Slack 通知は `open-pr` ジョブの失敗時に発火（matrix 内では発火させない、PR 化に失敗したら気付きたい）。matrix 自身の失敗検知は GitHub の Actions UI と PR 本文に任せる。

### フロントエンド: state とロード戦略

```ts
type GroupDef = {
  slug: string;
  displayName: string;
  xHandle: string;
  dataFile: string;
  color: string;
  colorDark?: string;
};

type State = {
  groups: GroupDef[];        // マニフェストから
  activeGroup: string;       // slug
  // 検索 / フィルタ / ソートはタブ間で共通
  query: string;
  minDurationSec: number;
  order: SortOrder;
  // 現在のビュー
  view: Video[];
  visible: number;
};
```

ロード戦略:

- 起動時に `data/groups.json` を fetch（ブロッキング）。失敗したらエラー表示。
- `?g=` を読んで manifest と照合。一致すればそれを active、無効値 / 未指定なら `groups[0]`（= aimai）。
- active group の `data_file` だけを fetch して描画（他 2 グループは未ロード）。
- タブクリック時、未ロードなら fetch → cache → recompute。Fuse 検索インスタンスはグループごとに lazy build してキャッシュ。
- キャッシュ: `Map<slug, Promise<VideosFile>>` で in-flight も共有。

```ts
const videosCache = new Map<string, Promise<VideosFile>>();
function getGroupVideos(g: GroupDef): Promise<VideosFile> {
  if (!videosCache.has(g.slug)) {
    videosCache.set(g.slug, loadVideosFile(`./data/${g.dataFile}`));
  }
  return videosCache.get(g.slug)!;
}
```

タブ切替時の挙動:

1. `state.activeGroup = newSlug`
2. `document.documentElement.dataset.group = newSlug` でテーマ色を切替
3. ヘッダーのサブ文と「X で見る →」リンクを更新
4. `getGroupVideos(group)` の解決を待ち、Fuse インスタンスもキャッシュから取得
5. `recompute()` で現在の検索 / フィルタ / ソートを新しい配列に適用
6. `pushState` で URL を更新（戻るボタン対応）

### フロントエンド: UI 構造

`web/index.html` を以下の構造に変更:

```html
<header class="site-header">
  <div>
    <div class="site-title">OISHII Movie Stock</div>
    <div class="site-sub" id="site-sub">@official_aimai の動画アーカイブ</div>
  </div>
  <a class="site-link" id="site-link" href="https://x.com/official_aimai" target="_blank" rel="noopener">X で見る →</a>
</header>

<nav class="tabs" role="tablist" id="tabs">
  <!-- main.ts が manifest からタブを生成 -->
</nav>

<div class="toolbar"><!-- 既存のまま --></div>
<main id="list" class="list"></main>
…
```

タブはサーバから配信される静的 HTML には書かず、起動時 manifest から生成する（`data/groups.json` がタブ定義の single source of truth であることを徹底）。

タブ要素の構造:

```html
<button role="tab" data-group="aimai" aria-selected="true" tabindex="0">美味しい曖昧</button>
<button role="tab" data-group="shokuzai" aria-selected="false" tabindex="-1">美味しい贖罪</button>
<button role="tab" data-group="mizutama" aria-selected="false" tabindex="-1">美味しい水玉</button>
```

- ARIA: `role="tablist"` / `role="tab"` / `aria-selected`。`tabindex` で active のみフォーカス可能、矢印キーでタブ間移動を可能にする。
- スマホ: タブが画面幅を超えたら横スクロール（`overflow-x: auto`）。

### CSS テーマ統合

既存の `--accent`（X ブルー固定）はマニフェスト駆動の `--group-accent` に置き換える。

```css
:root {
  --group-accent: #1d9bf0; /* デフォルトの safety net、起動直後の一瞬だけ */
}
/* main.ts が manifest から下記スタイルを動的注入 */
:root[data-group="aimai"]    { --group-accent: #bc2956; }
:root[data-group="shokuzai"] { --group-accent: #1A1A1A; }
:root[data-group="mizutama"] { --group-accent: #6CAAEF; }
[data-theme="dark"][data-group="shokuzai"] { --group-accent: #f7f9f9; }

.play-btn.open       { background: var(--group-accent); border-color: var(--group-accent); }
.site-link           { color: var(--group-accent); }
.tabs button[aria-selected="true"] { border-bottom: 3px solid var(--group-accent); }
```

CSS のグループ別ブロックはハードコードせず、起動時に manifest から `<style>` タグを生成して `<head>` に挿入する。これにより 4 グループ目を追加する際に CSS は触らずに済む。

タブの基本スタイル:

```css
.tabs {
  display: flex;
  gap: 4px;
  padding: 0 20px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
}
.tabs button {
  padding: 10px 16px;
  font-size: 13px;
  background: transparent;
  color: var(--muted);
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  white-space: nowrap;
}
.tabs button[aria-selected="true"] {
  color: var(--fg);
  font-weight: 600;
}
@media (max-width: 639px) {
  .tabs { padding: 0 14px; }
  .tabs button { padding: 12px 14px; font-size: 13px; min-height: 44px; }
}
```

### URL 状態

- `?g=<slug>&q=<query>&min1m=1` の形式（既存パラメータと併存）。
- `g` が省略 / 不正値 / デフォルト値（aimai）のときは URL から `g` を**省略する**（既存の `q` / `min1m` の挙動と一貫させる）。
- ブラウザ戻るに対応するため、タブ切替時は `pushState`、検索 / フィルタ更新は従来通り `replaceState`。`popstate` リスナーを追加し、戻る / 進むで URL の `g` / `q` / `min1m` を state に反映して `recompute()`。

### OGP / メタタグ

`web/index.html` の `<head>`:

```html
<title>OISHII Movie Stock</title>
<meta name="description" content="OISHII.inc 各グループ（美味しい曖昧 / 美味しい贖罪 / 美味しい水玉）の動画アーカイブ。X 投稿動画を一覧 / 検索 / 並び替えできる非公式ファンサイト。" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="OISHII Movie Stock" />
<meta property="og:title" content="OISHII Movie Stock" />
<meta property="og:description" content="OISHII.inc 各グループ（美味しい曖昧 / 美味しい贖罪 / 美味しい水玉）の動画アーカイブ。X 投稿動画を一覧 / 検索 / 並び替えできる非公式ファンサイト。" />
<meta property="og:url" content="https://hitsumabushi845.github.io/aimai-x-movie-stock/" />
<meta property="og:image" content="https://hitsumabushi845.github.io/aimai-x-movie-stock/oishii_movie_stock.png" />
<meta property="og:image:width" content="1536" />
<meta property="og:image:height" content="1024" />
<meta property="og:image:alt" content="OISHII Movie Stock — Archive of videos from OISHII.inc groups (Unofficial)" />
<meta property="og:locale" content="ja_JP" />
<meta name="twitter:card" content="summary_large_image" />
```

#### 画像 asset TODO

- `web/public/oishii_movie_stock.png`（1536×1024 推奨）を**ユーザーが用意して配置する**。
- 既存の `web/public/aimai_movie_stock.png` は当面残す（互換のため。次回 OGP 改修時に削除可）。
- 画像未配置のままマージしないこと（OGP リンクが 404 になる）。

### データ移行 / 初回バックフィル

このタスクの実装手順内に含めるオペレーション:

1. `git mv data/videos.json data/aimai.json` で履歴を保持してリネーム。
2. ローカルで Bearer Token をセットし、新しい 2 グループのバックフィルを実行:
   ```bash
   set -a; source .env; set +a
   uv run python -m scraper --group shokuzai \
     --manifest ../data/groups.json --schema ../schema/videos.schema.json --backfill
   uv run python -m scraper --group mizutama \
     --manifest ../data/groups.json --schema ../schema/videos.schema.json --backfill
   ```
3. 生成された `data/shokuzai.json` / `data/mizutama.json` を初回コミット（同じ PR に同梱する）。
4. `aimai.json` 側の整合性検査として、`update-data.yml` の dry-run（`workflow_dispatch`）を 1 度走らせ、3 グループとも `--require-existing` で通ることを確認する。

注意: バックフィルは X API 課金を消費するため、ユーザーがローカルで実行する。CI 上では `--require-existing` フラグにより既存ファイルが無いと失敗するので、初回コミット前に CI を走らせない。

### テスト方針

#### scraper

- `tests/test_groups.py`（新規）
  - マニフェストのロード成功 / スキーマ違反検知 / `slug` 重複検知。
  - `--group <slug>` から `x_handle` / `data_file` / クエリ文字列が正しく解決される。
  - `--all` で 1 グループの fetch 失敗が他のグループに波及しないこと（モックで failure を注入）、最終 exit code が非ゼロになること。
- 既存の merge / IO / source テストは無変更で通ること。

#### web

- `tests/groups.test.ts`（新規）
  - `data/groups.json` のロードと型変換。
  - 不正な slug の URL（`?g=invalid`）はデフォルトにフォールバック。
- `tests/main.test.ts` 相当（新規 or 既存テストへ追加）
  - タブ切替で active グループ・テーマ色（`document.documentElement.dataset.group`）・ヘッダーリンクが切り替わる。
  - 同一グループへの再切替でデータが再 fetch されない（`fetch` モックで呼び出し回数を確認）。
  - 検索 / フィルタ / ソートの状態がタブ切替で維持され、active グループの配列に対して適用される。
  - `popstate` で URL の `g` を変更すると state に反映される。
- `tests/index-html.test.ts`
  - 新タイトル / OGP の絶対 URL / `oishii_movie_stock.png` を指していることを検証（既存テストの値更新）。
  - `<nav id="tabs">` 要素が存在し、`role="tablist"` を持つ。

### 影響範囲（変更ファイル一覧）

新規:
- `data/groups.json`
- `schema/groups.schema.json`
- `data/shokuzai.json`, `data/mizutama.json`（バックフィル後に生成、PR に同梱）
- `web/src/groups.ts`（マニフェストロード + テーマ適用 + タブ生成）
- `scraper/src/scraper/groups.py`（マニフェストロード）
- `scraper/tests/test_groups.py`
- `web/tests/groups.test.ts`
- `web/public/oishii_movie_stock.png`（**ユーザー提供 asset**）

リネーム:
- `data/videos.json` → `data/aimai.json`（`git mv`）

修正:
- `scraper/src/scraper/cli.py`（`--group` / `--manifest` / `--all` 追加、後方互換維持）
- `scraper/src/scraper/__main__.py`（軽微）
- `web/index.html`（タイトル / OGP / 静的 nav placeholder）
- `web/src/main.ts`（state 拡張、タブ制御、`popstate`、URL 同期）
- `web/src/data.ts`（マニフェスト用ロード関数追加）
- `web/src/types.ts`（`GroupDef` / `GroupsManifest` 型追加）
- `web/src/styles.css`（`--group-accent`、`.tabs` ブロック追加、`--accent` 参照を `--group-accent` に）
- `web/src/theme.ts`（`data-theme` だけでなく `data-group` の管理を分離 / 統合）
- `.github/workflows/update-data.yml`（matrix + 集約 PR ジョブ）
- `web/tests/index-html.test.ts`, `web/tests/data.test.ts`, `web/tests/render.test.ts`, `web/tests/search.test.ts`（必要に応じて更新）
- `README.md`（バックフィル手順 / グループ追加方法）

### スコープ外（再掲）

- タブ別 OGP（`/aimai/`, `/shokuzai/`, `/mizutama/` の multi-page 出力）
- クロスグループ横断検索 UX
- `oishii_movie_stock.png` の画像作成（asset 自体はユーザー側で用意）
- favicon / Apple touch icon の更新
- 構造化データ (JSON-LD) の追加
