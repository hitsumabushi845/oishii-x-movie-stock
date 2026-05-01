# aimai-x-movie-stock

`@official_aimai`（X / 旧 Twitter）が投稿した動画（特にライブダイジェスト）を一覧表示する静的サイト。GitHub Pages でホスティングし、データは GitHub Actions の週次 cron で更新される。

> This site is an unofficial fan-made index. All content belongs to its respective owners.

## Stack

- **scraper/**: Python 3.12 + uv + httpx → X API v2 `search/all` (`from:official_aimai has:videos -is:retweet`) を呼んで `data/videos.json` を更新
- **web/**: Vite + TypeScript + Fuse.js — `data/videos.json` を fetch してコンパクトリストで表示、X 埋め込みでクリック再生
- **.github/workflows/**: `ci.yml` (PR テスト) / `deploy.yml` (Pages デプロイ) / `update-data.yml` (週次データ更新 PR)

詳細な設計: [`docs/superpowers/specs/2026-05-01-aimai-movie-stock-design.md`](docs/superpowers/specs/2026-05-01-aimai-movie-stock-design.md)

## 機能

- ✅ 投稿日時 / 動画長 / 本文の一覧表示（コンパクトリスト）
- ✅ クリックで X 埋め込みを inline 展開（複数同時可、widgets.js は遅延ロード）
- ✅ フリーワード検索（本文 + tags、Fuse.js でファジー）
- ✅ 並び順切り替え（新しい順 / 古い順）
- ✅ 動画長 1 分以上のみフィルタ
- ✅ 無限スクロール
- ✅ システムテーマ追従（`prefers-color-scheme`）
- ✅ 検索 / フィルタ状態を URL に同期（`?q=foo&min1m=1`）

## Quickstart

1. リポジトリを clone

   ```bash
   git clone https://github.com/hitsumabushi845/aimai-x-movie-stock
   cd aimai-x-movie-stock
   ```

2. **scraper の依存をインストール + Bearer Token を設定**

   ```bash
   cd scraper
   uv sync
   # .env を作る（チャットに貼らないこと）
   echo 'X_BEARER_TOKEN=YOUR_BEARER_TOKEN' > .env
   chmod 600 .env
   ```

3. **初回バックフィル**（ローカルで 1 度だけ）

   ```bash
   set -a; source .env; set +a   # bash; fish の場合は env 読み込みを適宜
   uv run python -m scraper \
     --data-file ../data/videos.json \
     --schema ../schema/videos.schema.json \
     --backfill
   ```

   `data/videos.json` が生成されるので commit & push:

   ```bash
   cd ..
   git add data/videos.json
   git commit -m "feat(data): initial backfill of videos.json"
   git push
   ```

4. **GitHub の設定**
   - Settings → Pages → Source を **GitHub Actions** に
   - Settings → Secrets and variables → Actions に登録：
     - `X_BEARER_TOKEN` — scraper 用 Bearer Token
     - `SLACK_WEBHOOK_URL` — 失敗通知用 Incoming Webhook URL

5. 以降は毎週月曜 18:00 UTC（火曜 03:00 JST）に `update-data.yml` が走り、差分があれば `bot/update-data` ブランチに PR が立つ

## ローカル開発

```bash
make install        # scraper と web の依存をまとめてインストール
make test           # scraper の pytest と web の vitest を実行
make web-dev        # フロントエンドの開発サーバ（http://localhost:5173）
make scrape-dry     # scraper の dry-run（書き込みなし、X API は呼ぶ）
```

ファイル単位でいうと：

```
.
├── data/videos.json          ← single source of truth、scraper が更新
├── schema/videos.schema.json ← JSON Schema、scraper が書き込み前に検証
├── scraper/                  ← Python パッケージ
│   ├── src/scraper/...
│   └── tests/
└── web/                      ← Vite + TS フロントエンド
    ├── src/...
    └── tests/
```

## X API について

- 使用 endpoint: `GET /2/tweets/search/all`
- クエリ: `from:official_aimai has:videos -is:retweet`
  - `filter:native_video` は dev tier 利用不可だったので `has:videos` に
  - `-is:retweet` で RT/引用 RT を除外
- バックフィル時は `start_time=2010-01-01T00:00:00Z` を付けて全期間を取得（無指定だと約 30 日のデフォルト窓に縛られる）
- pagination 間に 2 秒スリープを挟んで rate limit を回避

クレジット消費見積もり：

- 初回バックフィル：動画件数 / 100 リクエスト（参考：231 件で 3 リクエスト）
- 週次 cron：差分のみ、新規動画 0〜数件なら 1 リクエスト

## ライセンス

[MIT](LICENSE)
