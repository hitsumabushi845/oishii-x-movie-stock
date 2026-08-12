# oishii-x-movie-stock

OISHII.inc 各グループ（美味しい曖昧 / 美味しい贖罪 / 美味しい水玉）の公式 X が投稿した動画（特にライブダイジェスト）を、グループ別タブで一覧表示する静的サイト。GitHub Pages でホスティングし、データは GitHub Actions の週次 cron で更新される。

> This site is an unofficial fan-made index. All content belongs to its respective owners.

## Stack

- **scraper/**: Python 3.12 + uv + httpx → SocialData API `twitter/search` を呼び、`data/groups.json` を駆動して各グループの `data/<slug>.json` を更新
- **web/**: Vite + TypeScript + Fuse.js — `data/groups.json` を fetch、active グループの `data/<slug>.json` を遅延 fetch して描画。タブで切り替え。
- **.github/workflows/**: `ci.yml` (PR テスト) / `deploy.yml` (Pages デプロイ) / `update-data.yml` (週次データ更新 PR)

詳細な設計: [`docs/superpowers/specs/2026-05-01-aimai-movie-stock-design.md`](docs/superpowers/specs/2026-05-01-aimai-movie-stock-design.md)

## 機能

- ✅ 3 グループ（美味しい曖昧 / 美味しい贖罪 / 美味しい水玉）のタブ切り替え（`?g=<slug>`）
- ✅ グループごとのテーマカラー（タブ・再生ボタン・外部リンク）
- ✅ 投稿日時 / 動画長 / 本文の一覧表示（コンパクトリスト）
- ✅ クリックで X 埋め込みを inline 展開（複数同時可、widgets.js は遅延ロード）
- ✅ フリーワード検索（本文 + tags、Fuse.js でファジー）
- ✅ 並び順切り替え（新しい順 / 古い順）
- ✅ 動画長 1 分以上のみフィルタ
- ✅ 無限スクロール
- ✅ テーマ切り替えボタン（自動 / ライト / ダークを循環、選択は localStorage に保存）
- ✅ 自動テーマはシステム設定に追従（`prefers-color-scheme`）
- ✅ 検索 / フィルタ / タブ状態を URL に同期（`?g=...&q=foo&min1m=1`）

## Quickstart

1. リポジトリを clone

   ```bash
   git clone https://github.com/hitsumabushi845/oishii-x-movie-stock
   cd oishii-x-movie-stock
   ```

2. **scraper の依存をインストール + SocialData API key を設定**

   ```bash
   cd scraper
   uv sync
   # .env を作る（チャットに貼らないこと）
   echo 'SOCIALDATA_API_KEY=YOUR_SOCIALDATA_API_KEY' > .env
   chmod 600 .env
   ```

3. **初回バックフィル**（ローカルで 1 度だけ）

   ```bash
   set -a; source .env; set +a   # bash; fish の場合は env 読み込みを適宜
   uv run python -m scraper --all \
     --manifest ../data/groups.json \
     --manifest-schema ../schema/groups.schema.json \
     --schema ../schema/videos.schema.json \
     --data-dir ../data \
     --backfill
   ```

   `data/aimai.json` / `data/shokuzai.json` / `data/mizutama.json` が生成 / 上書きされるので commit & push:

   ```bash
   cd ..
   git add data/*.json
   git commit -m "feat(data): initial backfill of per-group videos.json"
   git push
   ```

4. **GitHub の設定**
   - Settings → Pages → Source を **GitHub Actions** に
   - Settings → Secrets and variables → Actions に登録：
     - `SOCIALDATA_API_KEY` — scraper 用 SocialData API key
     - `SLACK_WEBHOOK_URL` — 失敗通知用 Incoming Webhook URL

5. 以降は毎週月曜 18:00 UTC（火曜 03:00 JST）に `update-data.yml` が走り、差分があれば `bot/update-data` ブランチに PR が立つ

## ローカル開発

```bash
make install        # scraper と web の依存をまとめてインストール
make test           # scraper の pytest と web の vitest を実行
make web-dev        # フロントエンドの開発サーバ（http://localhost:5173）
make scrape-dry     # scraper の dry-run（書き込みなし、SocialData API は呼ぶ）
```

ファイル単位でいうと：

```
.
├── data/
│   ├── groups.json           ← グループ定義（slug / 表示名 / X ハンドル / テーマ色）
│   ├── aimai.json            ← @official_aimai
│   ├── shokuzai.json         ← @ofc_shokuzai
│   └── mizutama.json         ← @oishii_mizutama
├── schema/
│   ├── groups.schema.json
│   └── videos.schema.json
├── scraper/                  ← Python パッケージ
│   ├── src/scraper/...
│   └── tests/
└── web/                      ← Vite + TS フロントエンド
    ├── src/...
    └── tests/
```

## SocialData API について

- 使用 endpoint: `GET https://api.socialdata.tools/twitter/search`
- 認証: `Authorization: Bearer {SOCIALDATA_API_KEY}`
- クエリ: `from:official_aimai has:videos -is:retweet`
  - SocialData は X の検索をプロキシしており、X API v2 の演算子がそのまま使える
  - `has:videos` で動画を含むツイートに限定
  - `-is:retweet` で RT/引用 RT を除外
- 差分取得はクエリに `since_time:{last_synced_at}` 演算子を付与
- バックフィル時は `since_time:2010-01-01`（= `BACKFILL_EPOCH`）を付けて全期間を取得（無指定だと直近ツイートのみに縛られる）
- pagination は `next_cursor` を `cursor` として辿り、ページ間に 2 秒スリープを挟んで rate limit を回避

クレジット消費見積もり：

- SocialData は成功リクエストごとに従量課金。1 リクエスト ≒ 検索 1 ページ
- 初回バックフィル：動画件数に応じて数リクエスト
- 週次 cron：差分のみ、新規動画 0〜数件なら 1 リクエスト

## グループを追加するには

1. `data/groups.json` の `groups` 配列にエントリを追加（slug / display_name / x_handle / data_file / color、必要なら color_dark）。
2. ローカルで `--group <slug> --backfill` を実行して per-group ファイルを生成し、コミット。
3. `.github/workflows/update-data.yml` の matrix `group:` 配列に slug を追加。
4. CI / Pages デプロイは `data/*.json` を path filter で拾うので追加変更は不要。

## ライセンス

[MIT](LICENSE)
