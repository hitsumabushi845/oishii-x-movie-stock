# OISHII.inc 公式アカウント (@oishii_inc) タブの追加 — 設計

- 日付: 2026-05-29
- 対象: OISHII.inc 公式 X アカウント `@oishii_inc` の動画コンテンツを、既存の3グループと同様に管理する

## 背景・目的

現在、本リポジトリは `data/groups.json` をシングルソースとして3グループ（`aimai` / `shokuzai` / `mizutama`）の動画コンテンツをタブ管理している。Web フロント・スクレイパー・CI はすべてこのマニフェストを動的に読むため、グループ追加はマニフェストとデータ・workflow matrix への追記で完結する。

本変更では4つ目のグループ `oishii_inc` を追加し、`@oishii_inc` の動画を既存と同じ仕組みで管理できるようにする。

## 方針

マニフェスト駆動の既存設計をそのまま利用する。**アプリケーションコード（web / scraper）の変更は不要**で、設定とデータの追加のみで対応する。

## 変更点

### 1. `data/groups.json` にグループ定義を追加

`groups` 配列末尾に以下を追加する。

```json
{
  "slug": "oishii_inc",
  "display_name": "OISHII.inc",
  "x_handle": "oishii_inc",
  "data_file": "oishii_inc.json",
  "color": "#6B7280",
  "color_dark": "#FFFFFF"
}
```

- `display_name` は公式アカウント名どおり `OISHII.inc`。
- カラーは「白ブランド」を、既存 `shokuzai`（黒ブランド）と同じ**テーマ反転方式**で表現する。
  - ライトテーマ（白背景）: 視認可能な濃色。`shokuzai` の純黒 `#1A1A1A` と区別するためニュートラルグレー `#6B7280` を採用。
  - ダークテーマ: 白 `#FFFFFF`（`color_dark`）。
- アクセント色（`--group-accent`）はタブ下線・再生ボタン背景・サイトリンク文字色に使われるため、両テーマで読めることが必須要件。

### 2. `data/oishii_inc.json` を新規作成（空の雛形）

```json
{
  "$schema": "../schema/videos.schema.json",
  "generated_at": "2026-05-29T00:00:00Z",
  "last_synced_at": "2026-05-29T00:00:00Z",
  "source_query": "from:oishii_inc has:videos -is:retweet",
  "videos": []
}
```

- `videos.schema.json` 上、`videos: []` は有効（`minItems` 制約なし）。
- 実データの取得には X API キーが必要なため、初期はスクレイパーを手元実行せず空雛形をコミットする。実データは定期実行の `update-data.yml`（毎週 月 18:00 UTC）が後から埋める。

### 3. `.github/workflows/update-data.yml` の matrix に slug 追加

```yaml
matrix:
  group: [aimai, shokuzai, mizutama, oishii_inc]
```

- `--require-existing` で動くため、事前に `data/oishii_inc.json` が存在する必要がある（変更点2で担保）。
- 新規 Action は追加しないため pinact による SHA pinning 対象はない。

### 4. README.md

「グループを追加するには」の手順は汎用記述のため変更不要。グループ一覧を明示している箇所があれば `oishii_inc` を追記する程度。

## 検証

- `make scrape-dry`（`--all` でマニフェスト全件 dry-run）でマニフェストおよび新規データファイルがスキーマを通ることを確認する。
- CI の `schema-validate` ジョブはマニフェストを走査して各データファイルを検証するため、新グループも自動的に対象になる。
- Web をローカル起動し、4つ目のタブが表示・切替できること、ライト/ダーク両テーマでアクセントが読めることを確認する。

## コミット前

CLAUDE.md のワークフローに従い、コミット前に `/codex:review` を実行する。

## 非対象（YAGNI）

- スクレイパー実装・Web フロント・CSS・HTML テンプレートの変更（マニフェスト駆動のため不要）。
- 実データの即時取得（X API キー依存。定期実行に委ねる）。
