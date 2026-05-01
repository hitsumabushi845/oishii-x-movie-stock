# Responsive UI Design

- Date: 2026-05-01
- Scope: `web/` のみ（scraper / data / workflows は対象外）
- Status: approved (brainstorm)

## 目的

現在の `aimai-x-movie-stock` の web フロントエンドはデスクトップ前提のレイアウトで、スマートフォンから開いた際に以下のペインがある。

1. **本文の折り返しが過剰**：`.row` のグリッド (`90px 50px 1fr auto`) が狭幅で潰れ、本文が複数行に折り返して 1 行が縦に伸びる。
2. **文字が全体的に小さい**：本文 13px / メタ 11px は狭幅で読みづらい。
3. **X 埋め込みの左余白**：展開時の埋め込みが `.embed-host { grid-column: 3 / 5 }` のため日付 90px + 動画長 50px ＋ gap の左余白が広く取られる。

これら 3 点を解消し、スマートフォン (≦639px) でも同じ機能・同じ密度感で動画一覧を閲覧できるようにする。

## 非目的（YAGNI）

- 別レイアウトのカード化（タイル状サムネイル等）。情報源 `data/videos.json` にサムネイル URL が無く、また現状の「テキスト中心の一覧」という性格を維持する。
- ブラウザ後方互換性の特別対応。Chrome / Safari / Firefox の最新 2 メジャー以内のみを対象とする（既存方針と同じ）。
- `render.ts` の DOM 構造変更。既存 vitest テストの参照セレクタを維持する。
- ダークテーマの個別チューニング。CSS 変数経由でカラーが解決されるので副次的に追従する。
- スクレイパー / ワークフロー / データスキーマへの変更。

## 設計概要

### アプローチ

CSS のみ（`web/src/styles.css` に追記・修正）で実現する。`render.ts` および TypeScript ファイルは無修正。`web/index.html` の `<meta name="viewport">` は既に `width=device-width, initial-scale=1` のため変更不要。

レイヤは 2 つ：

1. **全幅で適用される磨き込み**：本文 / メタフォントの底上げと、X 埋め込みの行幅化。デスクトップ表示にも反映される（破壊的ではないマイナーな改善）。
2. **`@media (max-width: 639px)` でのスタック化**：行を `display: flex; flex-wrap: wrap` に切り替え、`order` と `flex-basis: 100%` を併用して `[date · dur ▶] / [text 2 行] / [embed]` の 3 段に再配置する。ツールバーは検索を独立行にし、ヘッダー / フッター余白を狭幅向けに詰める。

DOM 順は変えないため、現行の vitest テストは無修正で通る。

### Breakpoint

- `@media (max-width: 639px)` 単一。
- `min-width` 系は使わず、ベースを PC レイアウトとした `max-width` オーバーライド方式（既存 CSS の流儀と整合）。
- 640px はモバイル / タブレット境界の慣習的な値。

### 行レイアウト（モバイル）

DOM は現行のまま：

```
.row
├── .date
├── .dur
├── .text
├── .play-btn
└── .embed-host       ← 再生時のみ追加
```

CSS で flex-wrap し、子要素の論理順を `order` で操作する：

| 要素           | 配置 (mobile)               | 備考                                    |
| -------------- | --------------------------- | --------------------------------------- |
| `.date`        | 行 1 左                     | font-size 12px                          |
| `.dur`         | 行 1 中央寄り（date の右）  | `::before` で `· ` セパレータを挿入     |
| `.play-btn`    | 行 1 右端                   | `margin-left: auto` で右寄せ            |
| `.text`        | 行 2 全幅                   | `flex-basis: 100%; order: 3`、最大 2 行（line-clamp） |
| `.embed-host`  | 行 3 全幅（再生時のみ）     | `flex-basis: 100%; order: 4`            |

### ツールバー（モバイル）

- 検索 input を `flex-basis: 100%` で独立行にし、min-width: 0 で潰れ可。
- ソートボタン / フィルタ / 件数は次行に並ぶ。件数は `margin-left: auto` で右寄せ。
- フォントサイズと padding を全体的に少し拡張してタップしやすくする（ソートボタン padding 8px 14px / 高さ ≧36px）。

### ヘッダー / フッター（モバイル）

- 横並び (`flex space-between`) は維持。padding を `14px 20px → 12px 14px` に詰める。
- サブタイトルの長文は CSS の `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` で 1 行に切り詰め（HTML テキストは触らない）。

### X 埋め込み（全幅で変更）

```css
.embed-host {
  grid-column: 1 / -1;     /* 旧: 3 / 5 */
  margin-top: 10px;
}
```

デスクトップでは行の左端から右端まで使うようになる。モバイルでは flex 環境下で `flex-basis: 100%` により同等の挙動。

### フォント底上げ（全幅で変更）

| 要素                  | 旧    | 新    |
| --------------------- | ----- | ----- |
| `.row .text`          | 13px  | 14px  |
| `.row .date / .dur`   | 11px  | 12px  |

ツールバー / ヘッダー / フッターのフォントは全幅では維持し、モバイル時のみ `@media` 内で調整する。

## ファイル変更

| ファイル                  | 種別     | 変更内容                                                          |
| ------------------------- | -------- | ----------------------------------------------------------------- |
| `web/src/styles.css`      | 編集     | 全幅磨き込み + `@media (max-width: 639px)` ブロックの追加         |
| `web/src/render.ts`       | 無変更   | DOM 構造を維持                                                    |
| `web/index.html`          | 無変更   | viewport meta は既に設定済み                                      |
| `web/tests/*.test.ts`     | 無変更   | 既存テストの想定通過                                              |
| `.github/workflows/*.yml` | 無変更   | CSS のみ・新規依存なし                                            |

## エラーハンドリング / フォールバック

- `-webkit-line-clamp` は対象ブラウザ（Chrome / Safari / Firefox 最新 2 メジャー）でサポート済み。未対応環境では本文が 3 行以上に伸びるが致命的ではない（劣化が安全側）。
- `flex-wrap` / `gap` も同上。
- ダークテーマは既存 CSS 変数経由で適用されるため、本変更で別途対応する必要はない。

## 検証

### 自動

- `make test`（`web/` 側は vitest）が無修正で通ること。
  - DOM 構造を維持しているため `.row` / `.play-btn` / `.embed-host` / `data-id` を参照する既存テストは影響なし。

### 手動（`make web-dev` → Chrome DevTools device emulation）

| 確認項目                                              | 期待                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| 320px 幅                                              | レイアウト破綻なし、横スクロール出ない                          |
| 375px (iPhone SE)                                     | 行が 2 段スタック、本文 2 行、ボタン右上                        |
| 412px (Pixel 7)                                       | 同上、余白がやや広く                                            |
| 639px / 640px の境界                                  | 遷移時にがたつきなく一気に切り替わる                            |
| 768px (iPad portrait)                                 | デスクトップレイアウト                                          |
| 1024px / 1440px                                       | デスクトップレイアウト、フォント微増 / embed 全幅化以外は従来通り |
| モバイルで再生ボタン → 展開                           | embed が行幅いっぱい (左余白なし) で表示                        |
| `prefers-color-scheme: dark` 切り替え                 | 各幅で崩れなし                                                  |
| 検索 / ソート / フィルタ操作                          | モバイルでも操作可能、URL パラメータ同期も従来通り              |

### アクセシビリティ

- モバイルでの再生ボタン・ソートボタンが最低 36×36px 程度のタップ領域を満たすこと。
- `prefers-reduced-motion` に関する遷移は本変更で追加しない（既存も同様）。

## ロールバック

`web/src/styles.css` の差分のみで完結するため、`git revert` 1 コミットで元に戻る。`render.ts` を触らないことで、ロールバック後の状態が以前と完全に一致することを保証する。

## オープン項目

- なし（モバイルでのアクセシビリティ確認は実装後の手動チェックで担保）。
