# Embed Responsive Width Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホなど狭幅画面で X 投稿の埋め込みがビューポート幅を超えてはみ出し、ページ全体が横スクロール可能になっている (issue #2) を CSS のみで修正する。

**Architecture:** CSS-only。`web/src/styles.css` のみ編集する。`embed.ts` の widgets.js 呼び出し / `render.ts` の DOM 構造は無変更。`.embed-host` に `max-width: 100%; overflow: hidden;`、その直下に `max-width: 100% !important;` を強制し、widgets.js が inline で書き込む `width: 550px` を CSS 側で上書きする。さらにモバイル `@media (max-width: 639px)` で `.row > * { min-width: 0 }` を追加し、flex item の default `min-width: auto` による行押し出しを止める。

**Tech Stack:** Vite + TypeScript + vanilla CSS（`web/src/styles.css`）。テストは vitest + happy-dom（既存 `web/tests/*.test.ts`、変更なし）。視覚確認は `make web-dev` → Chrome DevTools の device emulation。

**仕様書:** [`docs/superpowers/specs/2026-05-03-embed-responsive-width-design.md`](../specs/2026-05-03-embed-responsive-width-design.md)

---

## File Structure

| File                          | Action     | Responsibility                                                      |
| ----------------------------- | ---------- | ------------------------------------------------------------------- |
| `web/src/styles.css`          | Modify     | `.embed-host` の幅制約と `.row > *` の min-width: 0 を追加          |
| `web/src/embed.ts`            | No change  | createTweet 呼び出しは現状維持                                       |
| `web/src/render.ts`           | No change  | DOM 構造維持                                                         |
| `web/tests/*.test.ts`         | No change  | DOM 構造維持により既存テストへの影響なし                             |

CSS のみの変更のため、本プランで自動テストを新規追加しない。各タスクの「検証」は (a) 既存 vitest が回帰なく通ること、(b) ブラウザ実機での目視確認、の 2 段で行う。

---

## Task 1: ベースライン確認 & 症状再現

修正前の状態で既存テストが pass し、issue #2 の症状（狭幅で埋め込み再生時にページが横スクロール）が再現することを確認する。

**Files:**
- Read only: `web/src/styles.css`, `web/tests/*.test.ts`

- [ ] **Step 1: 作業ブランチに居ることを確認**

Run:
```bash
git branch --show-current
```
Expected: `fix/embed-responsive-width`

- [ ] **Step 2: 既存テストを実行**

Run:
```bash
make test
```
Expected: scraper の pytest と web の vitest が両方 pass。`render.test.ts` / `data.test.ts` / `search.test.ts` 全件 pass。

- [ ] **Step 3: 開発サーバを起動**

Run（別ターミナル推奨。バックグラウンド実行でも可）:
```bash
make web-dev
```
Expected: `http://localhost:5173` で Vite が起動し、動画リストが表示される。

- [ ] **Step 4: 360px 幅で症状を再現**

Chrome DevTools の Toggle Device Toolbar（⌘+Shift+M）→ Responsive モード幅 360px で以下を確認：

| 操作                                  | 観察される症状                                                       |
| ------------------------------------- | -------------------------------------------------------------------- |
| 任意の動画行で「▶ 再生」をクリック    | 埋め込みが画面幅を超えて表示される                                   |
| ページを左右にスワイプ／指でドラッグ  | ページが横方向に動く（横スクロールが発生する）                       |
| デベロッパーコンソールで `document.documentElement.scrollWidth` を確認 | viewport 幅 (例: 360) より大きい値（例: 550 前後）になっている |

このタスクではコード変更・コミットは行わない。観察結果は Task 3 での修正後比較に使う。

---

## Task 2: CSS 修正の適用

`web/src/styles.css` に 3 か所の追記・修正を行う。

**Files:**
- Modify: `web/src/styles.css:72-74`（`.embed-host` ブロック）
- Modify: `web/src/styles.css:81` 付近（`@media (max-width: 639px)` ブロックの先頭付近）

- [ ] **Step 1: `.embed-host` ブロックに `max-width` と `overflow` を追加**

`web/src/styles.css` の現在 72-74 行目：

```css
.embed-host {
  grid-column: 1 / -1; margin-top: 10px; min-height: 40px;
}
```

を以下に置き換える：

```css
.embed-host {
  grid-column: 1 / -1; margin-top: 10px; min-height: 40px;
  max-width: 100%; overflow: hidden;
}
.embed-host > * {
  max-width: 100% !important;
}
```

ポイント:
- `max-width: 100%` で `.embed-host` 自体を親 `.row` 以下に制約。
- `overflow: hidden` で widget 生成途中の一時的な overflow をクリップ。
- `.embed-host > *` は X widgets.js が挿入する `<twitter-widget>`（あるいは将来の別形式）の直下要素を捕捉する汎用セレクタ。
- `!important` は widgets.js が直接書き込む inline `width: 550px` に勝つため必須。

- [ ] **Step 2: モバイルメディアクエリに `.row > *` の `min-width: 0` を追加**

`web/src/styles.css` の `@media (max-width: 639px) {` 直下、既存の `.row {` ブロックの直前に以下を追加する：

```css
@media (max-width: 639px) {
  .row > * {
    min-width: 0;
  }
  .row {
    display: flex;
    /* ...既存の中身は変更しない... */
```

ポイント:
- mobile の `.row` は `display: flex; flex-wrap: wrap;`。flex item の `min-width` は default で `auto`（コンテンツの最小サイズ）になり、内側に widget の 550px が居ると flex item 自体が 550px 以下に縮まなくなる。
- `min-width: 0` で「コンテンツ幅未満まで縮める」を許可し、`.embed-host` の `max-width: 100%` が実効化されるようにする。
- セレクタは `.row > *` で全ての直下子要素に適用（`.date` / `.dur` / `.text` / `.play-btn` / `.embed-host`）。他要素の表示は元から `flex-basis` が指定されているか短いコンテンツのため、`min-width: 0` を加えても見た目が変わらない。

- [ ] **Step 3: 編集後の差分を確認**

Run:
```bash
git diff web/src/styles.css
```
Expected: 上記 2 箇所の追加が見える。`.embed-host` ブロックに 2 行と新規 `.embed-host > *` ブロック、`@media (max-width: 639px)` 内に `.row > *` ブロックが増えている。他の既存ルールは無変更。

このタスクではまだコミットしない（次タスクで検証してからまとめてコミット）。

---

## Task 3: 検証 & コミット

修正が回帰を生まず、症状が解消したことを確認してからコミットする。

**Files:**
- Read only: `web/src/styles.css`, `web/tests/*.test.ts`

- [ ] **Step 1: vitest 回帰確認**

Run:
```bash
make web-test
```
Expected: `web/tests/*.test.ts` 全件 pass。DOM 構造を変えていないため failure はないはず。

- [ ] **Step 2: dev サーバを再読み込みし、360px で再生展開**

ブラウザの DevTools で 360px Responsive モードに戻し、Vite の HMR が新しい CSS を反映していることを確認した上で、Task 1 と同じ動画行で「▶ 再生」をクリックする。

| 確認項目                                                  | 期待                                              |
| --------------------------------------------------------- | ------------------------------------------------- |
| 埋め込み widget の幅                                      | 画面幅以下に収まっている                          |
| ページ左右スワイプ                                        | 横方向に動かない                                  |
| `document.documentElement.scrollWidth`                    | viewport 幅 (360) と等しい、もしくはそれ以下      |
| 埋め込みの中身（投稿本文・動画）                          | 文字切れなく読める                                |

- [ ] **Step 3: 320px / 375px / 412px で展開確認**

DevTools 幅を 320 / 375 / 412 に切り替え、それぞれで「▶ 再生」を試す。

| 幅    | 期待                                                                |
| ----- | ------------------------------------------------------------------- |
| 320px | 横スクロール出ない、widget が画面内                                 |
| 375px | 同上                                                                |
| 412px | 同上                                                                |

- [ ] **Step 4: 639/640px 境界とデスクトップ確認**

DevTools 幅を 639px → 640px → 768px → 1024px と変えて確認：

| 幅       | 期待                                                              |
| -------- | ----------------------------------------------------------------- |
| 639px    | モバイルレイアウト、widget は画面内に収まる                       |
| 640px    | デスクトップレイアウトに切替、widget は最大 550px                 |
| 768px+   | デスクトップレイアウト、widget は左寄せで最大 550px、左右に余白   |

- [ ] **Step 5: 縦横回転（モバイル emulation）の確認**

DevTools Device Toolbar で iPhone SE 等のプリセットを選び、回転ボタン（端末アイコン横の ⟲）で縦↔横を切替。展開済みの widget が新しいビューポート幅に追従して縮む／広がることを確認。

- [ ] **Step 6: ダークテーマ確認**

DevTools の Rendering タブで `prefers-color-scheme` を `dark` に切替。各幅で widget・行・文字色が崩れていないことを確認。

- [ ] **Step 7: 同時複数展開の確認**

任意のモバイル幅で 2-3 行を同時に再生展開。各 embed が個別に画面幅以内に収まり、相互に干渉しないこと。

- [ ] **Step 8: 動作確認結果をまとめる**

ターミナルに戻り、ここまでの手動検証で問題が無かったことを記録（コミットメッセージで言及するため）。問題があれば Task 2 に戻り、CSS を再調整。

- [ ] **Step 9: コミット**

Run:
```bash
git add web/src/styles.css
git commit -m "$(cat <<'EOF'
fix(web): clamp X embed width to viewport on narrow screens

X widgets.js が <twitter-widget> に inline width: 550px を直接書き込むため、
スマートフォン等の狭幅画面でページが横スクロール可能になっていた (#2)。
.embed-host と直下要素に max-width: 100% を、モバイルの .row 子要素に
min-width: 0 を加えることで CSS 側で抑え込む。

Closes #2
EOF
)"
```

Expected: 1 ファイル（`web/src/styles.css`）の変更を含むコミットが作成される。

- [ ] **Step 10: 最終確認**

Run:
```bash
git status
git log -1 --stat
```
Expected: working tree clean、最新コミットが上記メッセージで `web/src/styles.css` のみ変更を含む。

---

## 完了基準

1. `make test` が全件 pass
2. 320 / 360 / 375 / 412px で X 埋め込み再生時にページ横スクロールが発生しない
3. 640px 以上のデスクトップ幅では従来通りの表示（widget 最大 550px、左寄せ）が維持される
4. 縦横回転で widget が新しいビューポート幅に追従する
5. 1 コミットで完結（`web/src/styles.css` のみ）
