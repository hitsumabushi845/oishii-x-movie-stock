# Embed Responsive Width Design

- Date: 2026-05-03
- Scope: `web/src/styles.css` のみ
- Status: approved (brainstorm)
- Related: [`2026-05-01-responsive-ui-design.md`](2026-05-01-responsive-ui-design.md)
- Issue: [#2 埋め込みの width をレスポンシブ対応](https://github.com/hitsumabushi845/aimai-x-movie-stock/issues/2)

## 目的

スマートフォン等の狭幅画面で X 投稿の埋め込み（widgets.js が生成する `<twitter-widget>`）を再生展開すると、widget の幅がビューポート幅を超え、ページ全体が横スクロール可能になり「動いてしまう」。狭幅でも埋め込みが画面幅に収まるようにする。

## 根本原因

X widgets.js (`twttr.widgets.createTweet`) が生成する `<twitter-widget>` は、デフォルト挙動として `width: 550px`（X 公式のデフォルト最大幅）相当の inline スタイルで挿入される。挿入先である `.embed-host` には `max-width` の制約が無く、また親の `.row` は `display: flex; flex-wrap: wrap;` で flex item の `min-width` が default の `auto`（= コンテンツの最小サイズ）であるため、widget の 550px が flex item の最小サイズとして扱われ、行全体がビューポートを超えて広がる。結果としてページ横スクロールが発生する。

`web/src/embed.ts` で `createTweet` に `width` オプションを渡していないことも一因だが、CSS 側で抑え込めばリサイズ・回転にも自動追従でき、TypeScript 側の変更は不要。

## 非目的（YAGNI）

- `embed.ts` の `createTweet` に動的 `width` オプションを渡す改修。リサイズ追従に再描画ロジックが必要になり、複雑度が上がる。CSS で完結する。
- 別の埋め込み方式（oEmbed や独自 iframe）への切替。
- DOM 構造や `render.ts` の変更。既存 vitest テストの参照セレクタを維持する。
- `body { overflow-x: hidden; }` のような全体ページ規模の防御。本変更で局所対応できる範囲を超える。
- スクレイパー / ワークフロー / データスキーマへの変更。

## 設計概要

### アプローチ

CSS のみ（`web/src/styles.css` に追記・修正）で実現する。`render.ts` / `embed.ts` / TypeScript ファイルは無修正。

防御は 3 段：

1. **`.embed-host` 自体を親幅以下に制約**: `max-width: 100%; overflow: hidden;` を追加。widget 生成途中で一時的に幅が広がっても親をはみ出さない。
2. **内部 widget の inline `width` を CSS で上書き**: `.embed-host > * { max-width: 100% !important; }`。widgets.js が `<twitter-widget>` に直接書く inline `width: 550px` に対し、`max-width` で computed width をクランプする。`!important` は inline スタイルに勝つために必要。
3. **モバイル `.row` の flex item を縮小可能に**: `.row > * { min-width: 0 }` を `@media (max-width: 639px)` 内で追加。flex item の default `min-width: auto` を打ち消し、内側のコンテンツサイズが flex item の最小幅に伝播するのを止める。

### セレクタ設計

- `.embed-host > *` は、widgets.js の生成 DOM が `<twitter-widget>`（現行）/`<iframe class="twitter-tweet">`（過去）/将来別形式、のどれであっても直下の最初の要素には作用するため、X 側の内部仕様変更に対して耐性がある。
- `.row > *` も同様に汎用化し、特定の子要素クラスに依存しない。

### CSS 差分

```css
/* 全幅で適用 */
.embed-host {
  grid-column: 1 / -1;
  margin-top: 10px;
  min-height: 40px;
  max-width: 100%;       /* 追加 */
  overflow: hidden;      /* 追加 */
}
.embed-host > * {        /* 追加ブロック */
  max-width: 100% !important;
}

/* @media (max-width: 639px) 内に追加 */
@media (max-width: 639px) {
  .row > * {             /* 追加 */
    min-width: 0;
  }
  /* ...既存ルール... */
}
```

`.embed-host` の既存定義（`grid-column`, `margin-top`, `min-height`）は維持。

## ファイル変更

| ファイル                  | 種別     | 変更内容                                                          |
| ------------------------- | -------- | ----------------------------------------------------------------- |
| `web/src/styles.css`      | 編集     | `.embed-host` に `max-width` / `overflow`、`.embed-host > *` に `max-width !important`、`@media (max-width: 639px)` に `.row > * { min-width: 0 }` を追加 |
| `web/src/embed.ts`        | 無変更   | createTweet 呼び出しは現状維持                                     |
| `web/src/render.ts`       | 無変更   | DOM 構造を維持                                                     |
| `web/index.html`          | 無変更   |                                                                    |
| `web/tests/*.test.ts`     | 無変更   | 既存テストの想定通過                                               |
| `.github/workflows/*.yml` | 無変更   | CSS のみ・新規依存なし                                             |

## エラーハンドリング / フォールバック

- `<twitter-widget>` がもし `display: contents` 等で box を持たないケースに進化した場合、`max-width` が効かない可能性がある。その場合は `embed.ts` で動的 `width` 渡しに切り替える二段目の手段がある（本変更には含めず、必要時に再設計）。
- widgets.js のロード失敗は本変更の範囲外（既存挙動を維持）。
- ダークテーマは既存 CSS 変数経由で適用されるため副次的に追従。

## 検証

### 自動

- `make test`（`web/` 側は vitest）が無修正で通ること。
  - DOM 構造を維持しているため既存テストは影響なし。

### 手動（`make web-dev` → Chrome DevTools device emulation）

| 確認項目                                              | 期待                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| 320px 幅で再生展開                                    | embed が画面内に収まり、ページ横スクロール出ない                   |
| 375px (iPhone SE) で再生展開                          | 同上                                                               |
| 412px (Pixel 7) で再生展開                            | 同上                                                               |
| 639/640px 境界                                        | 切替時に widget 幅ががたつかない                                   |
| 768px+ (デスクトップ) で再生展開                      | embed は従来通り最大 550px、左右余白あり                           |
| 縦 → 横 回転（モバイル emulation）                    | 回転後も widget が新しいビューポート幅に収まる                     |
| 同時に複数行展開                                      | 各 embed がそれぞれ画面幅以内に収まる                              |
| `prefers-color-scheme: dark` 切り替え                 | 各幅で崩れなし                                                     |

### アクセシビリティ

- タップ領域・フォントサイズ等は前回の `2026-05-01-responsive-ui-design.md` で担保済み。本変更で劣化しないこと。

## ロールバック

`web/src/styles.css` の差分のみで完結するため、`git revert` 1 コミットで元に戻る。

## オープン項目

- なし。
