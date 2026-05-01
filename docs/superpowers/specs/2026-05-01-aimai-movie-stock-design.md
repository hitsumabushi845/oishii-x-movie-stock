# aimai-x-movie-stock 設計書

- 作成日: 2026-05-01
- 対象: `@official_aimai`（X / 旧 Twitter）の投稿動画一覧サイト

## 1. ゴールとスコープ

### ゴール

X アカウント `@official_aimai` が投稿した動画（特にライブダイジェスト）の**一覧性に優れた静的 Web サイト**を、GitHub Pages 上で公開・運用する。データは GitHub Actions の cron 実行で週次更新される。

### スコープ内

- 動画メタデータ（ID / URL / 投稿日時 / 動画長 / 本文）の収集と JSON ファイル化
- 一覧表示（コンパクトリスト + クリックで X 埋め込みを inline 展開）
- フリーワード検索（本文対象、クライアントサイド）
- 並び順切り替え（新しい順 / 古い順）
- 無限スクロール
- システムテーマ追従（`prefers-color-scheme`）
- 週1 cron でのデータ更新（PR 作成、人手 merge）
- GitHub Pages への自動デプロイ
- 失敗時の Slack 通知

### スコープ外

- 動画ファイル本体のダウンロード／ホスティング（X 埋め込みに任せる）
- 「ライブダイジェスト」自動分類（誤分類時は手動で JSON 編集）
- 認証付きの管理画面
- E2E テスト（Playwright 等）
- Renovate / Dependabot 等の依存更新自動化
- 多言語対応

### 設計上のキー判断

| 項目 | 決定 | 理由 |
|---|---|---|
| データ取得 | snscrape 系（要動作確認） | コスト 0、X API 有料化を回避 |
| データ形式 | JSON（`data/videos.json`） | エスケープ容易、`tags: []` の拡張余地 |
| フロント | Vite + TypeScript（バニラ） | 100 件規模で型・HMR の利点を享受 |
| 検索 | Fuse.js | 100 件規模ではインデックス不要、配列直接検索で十分 |
| 一覧 UI | コンパクトリスト（クリックで埋め込み展開、複数同時可） | 「一覧性」最重視、widget.js 重さ回避 |
| テーマ | `prefers-color-scheme` 追従 | OS 設定に従う、CSS 変数のみで実装 |
| cron | 毎週月曜 18:00 UTC（火曜 03:00 JST） | 平日朝に新着確認できる時刻 |
| データ更新 | PR 自動作成、人手 merge | 想定外差分を止められる安全弁 |
| デプロイ | `actions/deploy-pages` | 公式推奨、`gh-pages` ブランチ不要 |
| 失敗通知 | Slack（Incoming Webhook） | 既存運用に合わせる |

## 2. システム全体像

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Repository: aimai-x-movie-stock                     │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  scraper/    │    │  web/        │    │  data/       │  │
│  │  Python      │    │  Vite + TS   │    │  videos.json │  │
│  │  snscrape系  │    │  Fuse.js     │    │  (生データ)  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│        │                    │                    ↑          │
│        ▼                    ▼                    │          │
│  ┌──────────────────────┐  ┌──────────────────────┐         │
│  │ .github/workflows/   │  │ .github/workflows/   │         │
│  │  update-data.yml     │  │  deploy.yml          │         │
│  │  (週1 cron)          │  │  (main push トリガ)  │         │
│  └──────────────────────┘  └──────────────────────┘         │
│  ┌──────────────────────┐                                   │
│  │  ci.yml              │                                   │
│  │  (PR 単位のテスト)   │                                   │
│  └──────────────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
                │                          │
                ▼                          ▼
        ┌────────────┐              ┌────────────────┐
        │ X (search) │              │ GitHub Pages   │
        │ filter:    │              │ (静的ホスト)   │
        │ native_video│             └────────────────┘
        └────────────┘
```

データフロー：cron → scraper → JSON 差分 → PR 作成 → 人手 merge → main 更新 → `deploy.yml` → Pages 反映。

責務分離：

- **scraper/**：`data/videos.json` を更新する Python パッケージ
- **web/**：`data/videos.json` を fetch して描画するフロントエンド
- **data/**：単一の真実の場所（single source of truth）

## 3. リポジトリ構成

```
aimai-x-movie-stock/
├── README.md
├── LICENSE                          # MIT
├── .gitignore
├── .github/
│   └── workflows/
│       ├── update-data.yml          # 週1 cron でデータ更新 PR
│       ├── deploy.yml               # main push で Pages デプロイ
│       └── ci.yml                   # PR 単位のテスト
├── data/
│   └── videos.json                  # 真実の唯一の場所
├── schema/
│   └── videos.schema.json           # JSON Schema 定義
├── scraper/
│   ├── pyproject.toml               # uv 管理（Python 3.12）
│   ├── uv.lock
│   ├── README.md                    # ローカル実行手順
│   ├── src/
│   │   └── scraper/
│   │       ├── __init__.py
│   │       └── scrape.py            # メインスクリプト + CLI
│   └── tests/
│       └── test_scrape.py
└── web/
    ├── package.json                 # pnpm 管理
    ├── pnpm-lock.yaml
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    ├── public/                      # 静的アセット（favicon 等）
    ├── src/
    │   ├── main.ts                  # エントリ
    │   ├── data.ts                  # videos.json 取得 + 型定義
    │   ├── search.ts                # Fuse.js ラッパ
    │   ├── render.ts                # リスト描画 + 無限スクロール
    │   ├── embed.ts                 # X 埋め込み (widgets.js) 制御
    │   ├── theme.ts                 # prefers-color-scheme
    │   └── styles.css
    └── tests/
        ├── search.test.ts
        ├── render.test.ts           # Vitest + happy-dom
        └── data.test.ts
```

ツール選定：

- Python: **uv**（`astral-sh/setup-uv` Action）
- Node: **pnpm**（`pnpm/action-setup` Action）、Node 22+
- ビルド: **Vite**、`vite-plugin-static-copy` で `data/videos.json` を `dist/data/videos.json` へコピー

## 4. データモデル

### `data/videos.json`

```json
{
  "$schema": "../schema/videos.schema.json",
  "generated_at": "2026-04-29T03:00:12Z",
  "last_synced_at": "2026-04-28T11:23:45Z",
  "source_query": "from:official_aimai filter:native_video",
  "videos": [
    {
      "id": "1789012345678901234",
      "url": "https://x.com/official_aimai/status/1789012345678901234",
      "posted_at": "2026-04-28T11:23:45Z",
      "duration_sec": 187,
      "text": "【ライブダイジェスト】2026.4.27 渋谷WWW…",
      "tags": []
    }
  ]
}
```

### フィールド仕様

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `generated_at` | ISO 8601 UTC string | ✅ | scraper 実行時刻。フッタの「最終更新」表示に使用 |
| `last_synced_at` | ISO 8601 UTC string | ✅ | 次回 `since:` の基準値。取得結果の最大 `posted_at` |
| `source_query` | string | ✅ | 監査用。クエリ変更の追跡 |
| `videos` | array | ✅ | 動画エントリ |
| `videos[].id` | string | ✅ | X のステータス ID（数値型は使わない、64bit 越えのため） |
| `videos[].url` | string | ✅ | `https://x.com/official_aimai/status/{id}` |
| `videos[].posted_at` | ISO 8601 UTC string | ✅ | ツイート投稿時刻 |
| `videos[].duration_sec` | integer | ✅ | 動画長（秒）。`duration_millis / 1000` を四捨五入 |
| `videos[].text` | string | ✅ | ツイート本文。改行・絵文字込み |
| `videos[].tags` | string[] | ✅ | 手動付与の予約フィールド。空配列でも必須 |

### 不変条件

- `videos` は `posted_at` 降順（新しい順）
- `id` で一意
- `tags` は scraper が**書き換えない**（既存値を保持）

### マージ戦略（scraper 側）

1. 既存 `videos.json` を読み、`id → entry` の Map を作る
2. 取得した各動画について：
   - 既存にあれば `text`, `duration_sec` 等を最新で上書き、`tags` は既存値を保持
   - 既存になければ新規追加
3. 既存にあるが取得結果に無いものは**削除しない**（X 側削除でも歴史的記録として残す）
4. `id` で dedupe → `posted_at` 降順 → 書き込み
5. `last_synced_at` = 取得結果の最大 `posted_at`、`generated_at` = now()

`since:` の基準値に `videos[].posted_at` の max ではなく `last_synced_at` を使うことで、「ユーザが最新エントリを手で削除しても再取得されない」を担保する。

### JSON Schema

`schema/videos.schema.json` で全フィールドの型・必須・パターンを定義。

- scraper：書き込み前に `jsonschema` で検証、失敗なら `exit 4`
- `ci.yml`：PR 作成時に再検証（壊れた JSON が main に入らない安全網）
- IDE：`$schema` で補完

## 5. Scraper 詳細

### 言語と依存

- Python 3.12、uv 管理
- スクレイピング本体: **snscrape 系を第一候補**（master が壊れている場合は fork / `twscrape` / 自前 GraphQL に振替）
- 補助: `pydantic` v2、`jsonschema`、`httpx`

### マイルストーン 0（実装の最初に確定すること）

「2026 年 5 月時点で `from:official_aimai filter:native_video` を取得できるツール」を選定し、ローカルで疎通確認する。これが実装フェーズの最初のゲート。候補：

- snscrape の最新パッチ fork
- twscrape（要 X セッション）
- 自前 GraphQL クライアント
- X API v2（最終手段、Basic 月額 $100）

### CLI

```bash
# 通常実行（last_synced_at を使ったインクリメンタル）
uv run python -m scraper.scrape \
  --data-file ../data/videos.json \
  --schema ../schema/videos.schema.json

# 初回バックフィル（since 指定なし、ローカル専用）
uv run python -m scraper.scrape \
  --data-file ../data/videos.json \
  --schema ../schema/videos.schema.json \
  --backfill

# Actions 用（既存ファイル / last_synced_at 必須、無ければ exit 5）
uv run python -m scraper.scrape \
  --data-file ../data/videos.json \
  --schema ../schema/videos.schema.json \
  --require-existing \
  --summary-out $GITHUB_STEP_SUMMARY

# dry-run（書き込まない、stdout に diff）
uv run python -m scraper.scrape ... --dry-run
```

### 内部フロー

```
 1. 既存 videos.json を読む（無ければ空 + last_synced_at = None）
    - --require-existing 指定時、無い／空なら exit 5
 2. クエリ組み立て:
      base = "from:official_aimai filter:native_video"
      query = base + (f" since:{last_synced_at}" if last_synced_at else "")
 3. スクレイパでツイート取得（リトライ 3 回、指数バックオフ）
 4. 各ツイート → pydantic モデル変換
 5. 既存と Map マージ（既存 tags 保持）
 6. id 重複排除 → posted_at 降順ソート
 7. content_changed = (新しい videos 配列 ≠ 既存 videos 配列) を判定
    - 比較はフィールド単位の deep equal（generated_at / last_synced_at / source_query は含めない）
    - content_changed == False なら ファイル書き込みをスキップして exit 0
 8. last_synced_at = max(videos[].posted_at)、generated_at = now()
 9. JSON Schema 検証 → 失敗なら exit 4
10. dry-run なら diff を stdout、そうでなければファイル書き込み
11. 取得件数 / 新規件数 / 更新件数 を $GITHUB_STEP_SUMMARY に出力
```

**書き込み前判定の理由**：`generated_at` を毎回更新するだけでも `git diff` には差分が出るため、scraper 自体が「中身が変わっていなければ書かない」を担保しないと、毎週中身が同じだけの空 PR が生成され続ける。

### Exit code

| code | 意味 |
|---|---|
| 0 | 成功 |
| 1 | 想定外の例外 |
| 2 | スクレイパ／ネットワークエラー（リトライ後失敗） |
| 3 | 全件パース失敗 |
| 4 | スキーマ検証失敗（書き込みは行わない） |
| 5 | `--require-existing` で既存データ無し |

### 認証情報

snscrape 系の選定結果次第：

- 不要な実装（理想）→ Secrets 設定不要
- 必要な実装 → `X_AUTH_TOKEN`, `X_CT0` 等を Secrets に保存し、env で渡す。ローカルは `.env` + direnv

### テスト

- ユニット：マージロジック、ソート順、tags 保持、スキーマ検証起動
- 統合（実 X 接続）：`make integration` でオプトイン、CI では実行しない
- フィクスチャ：事前保存した HTML / GraphQL レスポンスでスクレイパをモック

## 6. フロントエンド詳細

### モジュール責務

| ファイル | 責務 | 主な公開 API |
|---|---|---|
| `src/main.ts` | エントリ。各モジュールの組み立て、初期化 | `bootstrap()` |
| `src/data.ts` | `videos.json` の fetch、型定義、ソート | `loadVideos()`, `type Video` |
| `src/search.ts` | Fuse.js のインデックス構築と検索 | `createIndex(videos)`, `search(query)` |
| `src/render.ts` | リスト描画、無限スクロール、行クリックでの埋め込み展開 | `renderList`, `appendBatch` |
| `src/embed.ts` | X widgets.js のロード、`twttr.widgets.createTweet()` | `embedTweet(id, container)` |
| `src/theme.ts` | `prefers-color-scheme` 監視、CSS 変数適用 | `initTheme()` |
| `src/styles.css` | CSS 変数によるテーマ切り替え、レイアウト | — |

### 起動フロー

```
bootstrap()
  ├─ initTheme()
  ├─ const videos = await loadVideos()      // /data/videos.json を fetch
  ├─ const fuse = createIndex(videos)
  ├─ renderList(videos.slice(0, 20))
  ├─ wireSortToggle(...)                    // ソート → 配列差し替え → 再描画
  ├─ wireSearchInput(...)                   // 入力ごとに fuse.search → 結果差し替え
  └─ wireInfiniteScroll(...)                // sentinel + IntersectionObserver
```

### 一覧 UI

- 1 行 1 動画、フィールド: 日付（90px）/ 動画長（50px）/ 本文 1 行（flex:1）/ 「▶ 再生」ボタン
- ボタンクリック → 行直下にコンテナ挿入 → `embedTweet(id, container)`
- 複数行を同時に展開可（既開行は閉じない）
- ボタン表記が「閉じる」に変わる → 再クリックでコンテナ remove

### X 埋め込み制御

- 初期描画では widgets.js を読み込まない
- 初回の `embedTweet` 呼び出しで `https://platform.twitter.com/widgets.js` を `<script>` 追加（Promise キャッシュ）
- `twttr.widgets.createTweet(id, container, { theme: currentTheme(), align: 'left' })`
- テーマ動的切り替え時、既開埋め込みは古いテーマのまま（仕様上の制約として README に明記）

### 検索（Fuse.js）

```ts
new Fuse(videos, {
  keys: ['text'],
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: 2,
})
```

- 入力 `input` イベントごとに即座に実行（100 件 × Fuse なら debounce 不要）
- 検索結果はソートトグルの影響を受ける
- 検索文字列を URL `?q=foo` と双方向同期（リロード保持、シェア可能）

### 無限スクロール

- 末尾の `<div data-sentinel></div>` を `IntersectionObserver` で監視
- 交差時に次の 20 件を `appendBatch` で追加
- 全件描画済みなら sentinel を外す
- 検索結果モード時も同じ仕組み（対象配列が違うだけ）

### テーマ

```css
:root {
  --bg: #fff;  --fg: #111;  --muted: #888;
  --accent: #1d9bf0;  --border: #eee;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #15202b;  --fg: #f7f9f9;  --muted: #8b98a5;
    --accent: #1d9bf0;  --border: #38444d;
  }
}
```

`theme.ts` は `matchMedia` を監視し、`document.documentElement` の `data-theme` 属性を更新（X widget には次回開き直し時に渡す）。

### バンドル

- `vite build` 出力：`index.html` + JS バンドル（gzip 30〜50KB 想定、Fuse.js 含む）+ CSS バンドル + コピーされた `data/videos.json`
- X widgets.js は外部 CDN なので bundle に入らない

### テスト（Vitest + happy-dom）

| テスト | 対象 |
|---|---|
| `data.test.ts` | 型ガード、不正 JSON のハンドリング |
| `search.test.ts` | Fuse 検索結果（部分一致、空文字、最小一致長） |
| `render.test.ts` | DOM 構築、行数、クリックハンドラ |

E2E（Playwright）は導入しない。

## 7. GitHub Actions ワークフロー

### 共通方針

- すべての third-party action は **`pinact` で SHA pinning**（CLAUDE.md 準拠）、バージョンコメント付き
- `permissions:` をジョブ毎に最小化
- `workflow_dispatch:` を全ワークフローに付ける
- Secrets: `SLACK_WEBHOOK_URL`、（必要なら）`X_AUTH_TOKEN`, `X_CT0`

### `update-data.yml`（データ更新）

- トリガ: `schedule: cron "0 18 * * 1"` + `workflow_dispatch`
- 権限: `contents: write`, `pull-requests: write`
- concurrency: `update-data` グループ、進行中はキャンセルしない
- ステップ:
  1. checkout
  2. setup-uv（Python 3.12）
  3. `uv sync --frozen`
  4. scraper を `--require-existing --summary-out $GITHUB_STEP_SUMMARY` で実行
  5. `git diff --quiet` で差分検出
  6. 差分あれば `peter-evans/create-pull-request` で固定ブランチ `bot/update-data` に PR 作成（既存 PR があれば更新）
     - title: `chore(data): weekly videos.json update`
  7. `if: failure()` で Slack 通知

### `deploy.yml`（Pages デプロイ）

- トリガ: `push: branches: [main]`、`paths: [web/**, data/videos.json, .github/workflows/deploy.yml]` + `workflow_dispatch`
- 権限: `contents: read`, `pages: write`, `id-token: write`
- concurrency: `pages` グループ、`cancel-in-progress: true`
- ジョブ構成:
  - `build`: pnpm install → `pnpm build` → `actions/configure-pages` → `actions/upload-pages-artifact`
  - `deploy`（needs: build）: `actions/deploy-pages`
  - 各ジョブで `if: failure()` Slack 通知

### `ci.yml`（PR テスト）

- トリガ: `pull_request`
- ジョブ（並列）:
  - `scraper-test`: setup-uv → `uv sync --frozen` → `uv run pytest`
  - `web-test`: setup-node + pnpm → `pnpm install --frozen-lockfile` → `pnpm test` → `pnpm build`（ビルド可否も担保）
  - `schema-validate`: `python -c "import json,jsonschema;jsonschema.validate(json.load(open('data/videos.json')), json.load(open('schema/videos.schema.json')))"` 相当
- すべて成功しないと merge 不可（branch protection は実装後に手動設定）

### Slack 通知文面

1 行で「ワークフロー名 + run へのリンク」のみ。詳細は GitHub UI と通知メールに任せる。

## 8. 開発・運用

### Quickstart（README 冒頭）

```
1. リポジトリを clone
2. cd scraper && uv sync
3. uv run python -m scraper.scrape \
     --data-file ../data/videos.json \
     --schema ../schema/videos.schema.json \
     --backfill
4. 生成された data/videos.json を git add → commit → push（最初の 1 回だけ）
5. GitHub の Settings → Pages を "GitHub Actions" に設定
6. Secrets に SLACK_WEBHOOK_URL を登録
7. （必要なら）X 認証情報を Secrets に登録
8. 以降は週1 cron が動く
```

### ローカル開発

```bash
# scraper
cd scraper
uv sync
uv run pytest
uv run python -m scraper.scrape ... --dry-run   # 動作確認

# web
cd web
pnpm install
pnpm dev          # http://localhost:5173
pnpm test
pnpm build && pnpm preview
```

`pnpm dev` 時は `vite.config.ts` の `server.fs.allow` で `../data` を許可し、開発サーバから `data/videos.json` を読めるようにする。

### `.gitignore`

```
.superpowers/
**/__pycache__/
**/.pytest_cache/
scraper/.venv/
web/node_modules/
web/dist/
.env
.env.local
.DS_Store
```

### コミット規約

- **Conventional Commits** 推奨（`feat:`, `fix:`, `chore:`, `docs:`, `ci:`）
- bot による PR は `chore(data): update videos.json`
- 強制はしないが README に明記

### ライセンスと法的留意

- コード: **MIT**
- サイトはあくまで X コンテンツへのインデックス。動画ファイル自体は X から配信される
- ツイート本文は出典明示（X リンク）+ ファンメイドの非商用 index として運用
- README に「This site is an unofficial fan-made index. All content belongs to its respective owners.」を明記

## 9. リスクと未解決事項

### リスク

- **scraper の選定**：snscrape master が壊れている可能性。マイルストーン 0 で代替を確定する必要
- **X 仕様変更**：埋め込み widgets.js / 検索 API が今後変わる可能性。週1 cron が長期間失敗し続けたら見直す
- **認証情報の漏洩**：twscrape 等で X セッション Cookie を Secrets に置く場合、定期的な失効確認が必要

### 未解決（実装フェーズで決める）

- 具体的なスクレイピング実装（マイルストーン 0 の結果次第）
- favicon / ロゴ
- ブランディング（Aimai 公式の色味やロゴを参考にするかは要オーナー判断）
- Renovate / Dependabot の導入（今回スコープ外）

## 10. 用語

- **`@official_aimai`**: 対象の X アカウント
- **ライブダイジェスト**: ライブの抜粋動画。今回は自動分類しない
- **インクリメンタル更新**: `since:<last_synced_at>` を使った差分取得
- **バックフィル**: アカウント開設からの全動画取得（ローカル専用、初回のみ）
