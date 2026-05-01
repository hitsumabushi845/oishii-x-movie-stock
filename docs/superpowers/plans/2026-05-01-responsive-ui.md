# Responsive UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `web/` フロントエンドを 640px 未満の幅で見やすくする — 行を 2 段スタック化、ツールバー縦積み、X 埋め込み行幅化、本文/メタフォントを底上げ。

**Architecture:** CSS-only。`web/src/styles.css` のみ編集する。`render.ts` の DOM 構造は不変。ベースを PC レイアウトとし、`@media (max-width: 639px)` でオーバーライド。行は flex-wrap + `order` + `flex-basis: 100%` で 3 段（[date · dur ▶] / [text 2 行] / [embed]）に再配置。

**Tech Stack:** Vite + TypeScript + vanilla CSS（`web/src/styles.css`）。テストは vitest + happy-dom（既存 `web/tests/*.test.ts`、変更なし）。視覚確認は `make web-dev` → Chrome DevTools の device emulation。

**仕様書:** [`docs/superpowers/specs/2026-05-01-responsive-ui-design.md`](../specs/2026-05-01-responsive-ui-design.md)

**注意:** 本プロジェクトの規約（`/Users/hitsumabushi845/.claude/CLAUDE.md`）により、コミット前に `/codex:review` を実行する。本プランでは Task 6 で全体に対して 1 回実行する方針とする。

---

## File Structure

| File                          | Action     | Responsibility                                                      |
| ----------------------------- | ---------- | ------------------------------------------------------------------- |
| `web/src/styles.css`          | Modify     | 全幅磨き込み（フォント / embed 全幅）と `@media (max-width: 639px)` ブロック追加 |
| `web/src/render.ts`           | No change  | DOM 構造維持                                                        |
| `web/index.html`              | No change  | viewport meta は既に設定済み                                        |
| `web/tests/render.test.ts`    | No change  | 既存テスト（`.row` / `.play-btn` / `.embed-host` セレクタ参照）を維持 |
| `web/tests/data.test.ts`      | No change  | 影響なし                                                            |
| `web/tests/search.test.ts`    | No change  | 影響なし                                                            |

CSS のみの変更のため、本プランに自動テストの新規追加は無い。各タスクの「テスト」は (a) 既存 vitest が回帰なく通ること、(b) ブラウザ実機での目視確認、の 2 段で行う。

---

## Task 1: ベースライン確認

現状で既存テストが pass し、PC・モバイル両方の表示が想定通りであることを確認する。回帰の参照点を明確にするための最初のタスク。

**Files:**
- Read only: `web/src/styles.css`, `web/tests/*.test.ts`

- [ ] **Step 1: 既存テストを実行**

Run:
```bash
make test
```
Expected: scraper の pytest と web の vitest が両方 pass。`render.test.ts` は 4 件、`data.test.ts` と `search.test.ts` も全 pass。

- [ ] **Step 2: 開発サーバを起動**

Run:
```bash
make web-dev
```
Expected: `http://localhost:5173` で Vite が起動。ブラウザで開いて 1 行以上の動画リストが表示されること。

- [ ] **Step 3: 現状を 360px と 1024px で目視**

Chrome DevTools の Toggle Device Toolbar（⌘ + Shift + M）→ Responsive モードで以下を確認：

| 幅      | 観察ポイント                                                                                  |
| ------- | --------------------------------------------------------------------------------------------- |
| 360px   | 行の本文がほぼ表示されない（日付 + 動画長 + ボタンで横が埋まり 1fr が窮屈）                   |
| 360px   | ▶ 再生 → 埋め込みが本文列だけに揃い左に約 140px の余白                                       |
| 1024px  | 行が `90px / 50px / 1fr / auto` のグリッドで整列                                              |

このタスクではコード変更・コミットは行わない。観察結果は次タスク以降の比較対象。

---

## Task 2: 全幅で適用される磨き込み（フォント底上げ + 埋め込み全幅）

PC 表示にも反映される変更。本文 13→14px、メタ 11→12px、`.embed-host` の `grid-column` を `3 / 5` から `1 / -1` に変える。デスクトップから先に直すことで、後のモバイルブロックは差分のみを書ける。

**Files:**
- Modify: `web/src/styles.css`

- [ ] **Step 1: `.row .text` のフォントサイズを 13px → 14px に**

`web/src/styles.css` の `.row .date, .row .dur` ルールと `.row .text` ルールを次の通り更新：

```css
.row .date, .row .dur { font-size: 12px; color: var(--muted); }
.row .text { font-size: 14px; line-height: 1.4; }
```

旧:
```css
.row .date, .row .dur { font-size: 11px; color: var(--muted); }
.row .text { font-size: 13px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; }
```

注: 既存の `overflow: hidden; text-overflow: ellipsis;` は `white-space: nowrap` が無いと無効（PC で実効していない）ため削除する。モバイル側で `-webkit-line-clamp` による truncation を使う。

- [ ] **Step 2: `.embed-host` を行幅いっぱいに**

```css
.embed-host {
  grid-column: 1 / -1;
  margin-top: 10px;
  min-height: 40px;
}
```

旧:
```css
.embed-host {
  grid-column: 3 / 5; margin-top: 10px;
}
```

`min-height: 40px` は元から無かった場合は新規追加。元の宣言にあった場合はそのまま残す（既存の `min-height: 40px;` を維持）。

- [ ] **Step 3: vitest で回帰なしを確認**

Run:
```bash
make web-test
```
Expected: 全 pass。`render.test.ts` のセレクタ参照は不変なので影響しない。

- [ ] **Step 4: ブラウザで PC 幅 (1024px) の見た目を確認**

`make web-dev` の状態で、DevTools 1024px 幅にて：

| 観察ポイント                                  | 期待                                                |
| --------------------------------------------- | --------------------------------------------------- |
| 本文                                          | 1px 大きくなり、わずかに読みやすい                  |
| 日付・動画長                                  | 1px 大きくなり、視認性向上                          |
| 動画の ▶ 再生 → 展開                          | 埋め込みが行の左端から右端まで広がる（左余白なし） |
| 既存のリスト密度                              | 行高はほぼ変わらず、レイアウト崩れなし              |

- [ ] **Step 5: コミット**

Run:
```bash
git add web/src/styles.css
git commit -m "$(cat <<'EOF'
feat(web): bump body/meta fonts and span embed full row

本文 13→14px、メタ 11→12px に底上げ。`.embed-host` を `grid-column: 1 / -1`
にして埋め込みが行幅いっぱいに広がるように変更（旧: `3 / 5` で日付・動画長
列のぶん左に余白が出ていた）。動作不能な `text-overflow: ellipsis` も併せて削除。

Refs: docs/superpowers/specs/2026-05-01-responsive-ui-design.md
EOF
)"
```

---

## Task 3: モバイル幅の行レイアウト（flex 2 段スタック）

`@media (max-width: 639px)` ブロックを新設し、`.row` を flex-wrap + `order` で `[date · dur ▶] / [text 2 行] / [embed]` に再配置する。本タスクで初めて `@media` ブロックが追加される。

**Files:**
- Modify: `web/src/styles.css`

- [ ] **Step 1: `@media (max-width: 639px)` ブロックを追加し、行を flex 化**

`web/src/styles.css` の末尾（`.site-footer` ルールの直後）に追加：

```css
@media (max-width: 639px) {
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 8px;
    row-gap: 6px;
    padding: 12px 14px;
  }
  .row .text {
    flex-basis: 100%;
    order: 3;
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .row .dur::before {
    content: "·";
    margin-right: 6px;
    color: var(--muted);
  }
  .row .play-btn {
    margin-left: auto;
    padding: 6px 12px;
    font-size: 12px;
  }
  .row .embed-host {
    flex-basis: 100%;
    order: 4;
  }
}
```

**説明:**
- `display: flex; flex-wrap: wrap` で行を `display: grid` から切り替え。
- `.row .text` に `flex-basis: 100%; order: 3` を当てることで本文が独立行に折り返し、最大 2 行で `-webkit-line-clamp` truncation。
- `.row .dur::before` の `·` で日付と動画長の間にセパレータを挿入（DOM 不変）。
- `.row .play-btn` の `margin-left: auto` で 1 行目の右端へ。
- `.row .embed-host` も `flex-basis: 100%; order: 4` で展開時に独立行で行幅いっぱい。

- [ ] **Step 2: vitest で回帰なしを確認**

Run:
```bash
make web-test
```
Expected: 全 pass。`render.test.ts` は DOM 構造のみを参照しており、CSS 追加は影響しない。

- [ ] **Step 3: 360px で目視確認**

DevTools で 375px (iPhone SE) と 360px：

| 観察ポイント                          | 期待                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| 1 行目                                | 左から `2026-04-20 · 2:34 ........... ▶ 再生`                                     |
| 2 行目                                | 本文が最大 2 行（はみ出し分はカット）                                              |
| 行全体                                | 行高は現状の約 1.5〜2 倍に収まる                                                   |
| ▶ 再生 → 展開                         | 3 行目に埋め込みが行幅いっぱいで表示される                                        |
| 行間                                  | 行同士の境界線（`border-bottom`）は維持                                           |

- [ ] **Step 4: 640px の境界を確認**

DevTools で幅を 640 → 639 → 638 → 640 とドラッグして遷移を観察：

| 観察ポイント                  | 期待                                                  |
| ----------------------------- | ----------------------------------------------------- |
| 640px → 639px の遷移          | grid → flex に切り替わり、行が 2 段化                |
| 639px → 640px の戻り          | flex → grid に戻り、`90px 50px 1fr auto` 整列に復帰   |
| いずれの方向でも              | レイアウトのチラつき無し                              |

- [ ] **Step 5: コミット**

Run:
```bash
git add web/src/styles.css
git commit -m "$(cat <<'EOF'
feat(web): stack row layout under 640px

`@media (max-width: 639px)` で `.row` を flex-wrap に切り替え、
`[date · dur ▶] / [text 2 行] / [embed]` の 3 段構造に再配置。
本文は `-webkit-line-clamp: 2` で折り返しすぎを抑制。
DOM は不変なので既存 vitest テストは影響なし。

Refs: docs/superpowers/specs/2026-05-01-responsive-ui-design.md
EOF
)"
```

---

## Task 4: モバイル幅のツールバー（検索を独立行に）

検索 input をモバイルでは独立行に出し、ソート・フィルタ・件数を 2 行目に並べる。タップ余白を確保するためボタン padding を拡張。

**Files:**
- Modify: `web/src/styles.css`

- [ ] **Step 1: `@media (max-width: 639px)` ブロックにツールバー用ルールを追記**

Task 3 で追加した `@media` ブロックの末尾（`.row .embed-host` ルールの直後、ブロック閉じ括弧の手前）に追加：

```css
  .toolbar {
    padding: 10px 14px;
    gap: 8px;
  }
  .toolbar input[type=search] {
    flex-basis: 100%;
    min-width: 0;
    font-size: 14px;
    padding: 8px 10px;
  }
  .sort button {
    padding: 8px 14px;
    font-size: 12px;
  }
  .filter {
    font-size: 12px;
  }
  .count {
    font-size: 11px;
    margin-left: auto;
  }
```

**説明:**
- `.toolbar input[type=search]` の `flex-basis: 100%; min-width: 0` で検索が独立行を占有。
- `.sort button` の padding 拡張で最低 36px 高さのタップ領域を確保。
- `.count { margin-left: auto }` で件数がソート/フィルタの右端に飛んで見やすく。

- [ ] **Step 2: vitest で回帰なしを確認**

Run:
```bash
make web-test
```
Expected: 全 pass。

- [ ] **Step 3: 360px / 375px で目視確認**

| 観察ポイント                                          | 期待                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| 1 行目                                                | 検索 input が幅いっぱい                                           |
| 2 行目                                                | `[新しい順] [古い順] ☑ 1分以上のみ ........ 231 件`                |
| ソートボタン                                          | padding が広がり指でタップしやすい                                |
| 検索文字列入力                                        | フォントが 14px で読みやすく、リスト即時フィルタが機能            |

- [ ] **Step 4: PC 幅 (1024px) で副作用がないことを確認**

| 観察ポイント                          | 期待                                  |
| ------------------------------------- | ------------------------------------- |
| ツールバー（PC）                      | 既存の 1 行レイアウト維持              |
| 検索 input width                      | 既存の `flex: 1; min-width: 200px`    |

- [ ] **Step 5: コミット**

Run:
```bash
git add web/src/styles.css
git commit -m "$(cat <<'EOF'
feat(web): adapt toolbar to narrow widths

640px 未満で検索 input を独立行に、ソート/フィルタ/件数を次行に並べる。
ボタン padding を拡張して指タップしやすく、件数は右端に寄せて見やすく。

Refs: docs/superpowers/specs/2026-05-01-responsive-ui-design.md
EOF
)"
```

---

## Task 5: モバイル幅のヘッダー / フッター / サブタイトル詰め

ヘッダー・フッターの padding を狭幅向けに詰め、長いサブタイトルは ellipsis で 1 行に収める。HTML テキストには触らない。

**Files:**
- Modify: `web/src/styles.css`

- [ ] **Step 1: `@media (max-width: 639px)` ブロックにヘッダー/フッタールールを追記**

Task 4 で追加したツールバールールの直後（`.count` ルールの直後、ブロック閉じ括弧の手前）に追加：

```css
  .site-header {
    padding: 12px 14px;
  }
  .site-title {
    font-size: 14px;
  }
  .site-sub {
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .site-footer {
    padding: 12px 14px;
  }
```

**説明:**
- ヘッダー/フッター padding を `14px 20px` から `12px 14px` に圧縮。
- `.site-sub` は `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` で 1 行 ellipsis。「@official_aimai のライブダイジェスト等の動画一覧」が「@official_aimai のライブダイジェスト等の動画一…」のように切れる。

- [ ] **Step 2: vitest で回帰なしを確認**

Run:
```bash
make web-test
```
Expected: 全 pass。

- [ ] **Step 3: 360px / 320px で目視確認**

| 観察ポイント                                  | 期待                                                                |
| --------------------------------------------- | ------------------------------------------------------------------- |
| ヘッダー左                                    | タイトル + サブ（サブは 1 行で末尾 ellipsis）                       |
| ヘッダー右                                    | 「X で見る →」リンクが折り返さず収まる                              |
| ヘッダー全体                                  | 横スクロール無し                                                    |
| フッター                                      | padding が詰まり、テキスト + GitHub リンクがコンパクトに            |
| 320px 極小幅                                  | レイアウトが破綻せず横スクロール無し                                |

- [ ] **Step 4: PC 幅 (1024px) で副作用がないことを確認**

| 観察ポイント        | 期待                                                  |
| ------------------- | ----------------------------------------------------- |
| ヘッダー（PC）      | padding `14px 20px` のまま、サブはフル文字列表示      |
| フッター（PC）      | padding `14px 20px` のまま                            |

- [ ] **Step 5: コミット**

Run:
```bash
git add web/src/styles.css
git commit -m "$(cat <<'EOF'
feat(web): tighten header and footer on mobile

640px 未満でヘッダー / フッターの padding を `14px 20px → 12px 14px` に圧縮。
サブタイトルは `white-space: nowrap + ellipsis` で 1 行に収める
（HTML テキストは不変、CSS だけで切り詰め）。

Refs: docs/superpowers/specs/2026-05-01-responsive-ui-design.md
EOF
)"
```

---

## Task 6: 全幅マトリクス確認 + ダーク + コードレビュー

仕様書の検証マトリクスを全幅で確認し、ダークテーマの崩れ有無、タップ領域の最低サイズを最終チェック。最後に `/codex:review` を実行。

**Files:**
- Read only: `web/src/styles.css`（差分確認）

- [ ] **Step 1: 仕様書の検証マトリクスを実施**

`make web-dev` の状態で、DevTools の Responsive モードで以下を順番に確認：

| 幅      | 確認項目                                                                  |
| ------- | ------------------------------------------------------------------------- |
| 320px   | 横スクロール無し、ヘッダー / ツールバー / 行 すべて破綻なし               |
| 375px   | iPhone SE: 行 2 段、本文 2 行、ボタン右上                                 |
| 412px   | Pixel 7: 上記と同じ、余白がやや広く見える                                 |
| 639px   | モバイルレイアウト境界                                                    |
| 640px   | デスクトップレイアウトに切り替わる                                        |
| 768px   | iPad portrait: 4 列グリッドの行レイアウト                                 |
| 1024px  | デスクトップ通常表示                                                      |
| 1440px  | デスクトップ通常表示                                                      |

各幅で動画を 1 件展開し、X 埋め込みが行幅いっぱいに表示されることを確認。

- [ ] **Step 2: ダークテーマ確認**

DevTools → Rendering → Emulate CSS media feature `prefers-color-scheme` を `dark` に設定し、360px と 1024px で：

| 観察ポイント                  | 期待                                                          |
| ----------------------------- | ------------------------------------------------------------- |
| 背景・文字色                  | 既存のダークパレット（`#15202b` / `#f7f9f9`）で表示           |
| ボーダー                      | `--border: #38444d` が適用されレイアウト崩れ無し              |
| ホバー状態                    | `--row-hover: #1c2733` が反映                                 |

- [ ] **Step 3: タップ領域確認**

DevTools の Inspector で、モバイル幅において：

| 要素                  | 期待                                                  |
| --------------------- | ----------------------------------------------------- |
| `.row .play-btn`      | 高さ ≧ 36px（`padding: 6px 12px` + `font-size: 12px`）|
| `.sort button`        | 高さ ≧ 36px（`padding: 8px 14px` + `font-size: 12px`）|
| `.filter input`       | チェックボックスは OS デフォルトでタップ可能          |

- [ ] **Step 4: 全変更の差分を確認**

Run:
```bash
git diff main -- web/src/styles.css
```
Expected: `web/src/styles.css` のみが変更され、行数は ~70 行程度の追加 + 数行の置換。他ファイルの変更が混入していないこと。

- [ ] **Step 5: `/codex:review` を実行**

ターミナルで `/codex:review` を実行し、コミット予定の差分（main からの差分）に対するレビューを得る。

レビューで指摘があれば該当タスクに戻って修正。指摘なし、または軽微な指摘のみで修正不要であれば、本タスクは完了。修正をコミットする場合：

```bash
git add web/src/styles.css
git commit -m "$(cat <<'EOF'
fix(web): address codex:review findings on responsive CSS

Refs: docs/superpowers/specs/2026-05-01-responsive-ui-design.md
EOF
)"
```

- [ ] **Step 6: 既存テスト最終確認**

Run:
```bash
make test
```
Expected: scraper の pytest と web の vitest が両方 pass。

- [ ] **Step 7: 完了の確認**

`git log --oneline main..HEAD` で本実装の 4〜5 件のコミットが並んでいること。

```bash
git log --oneline main..HEAD
```

ここで作業ブランチをマージするか PR にするかは利用者の判断（このプランの範囲外）。

---

## Self-Review

**1. Spec coverage:**

| Spec 要件                                                | 該当タスク      |
| -------------------------------------------------------- | --------------- |
| 本文の折り返しが過剰の解消                               | Task 3 (line-clamp 2) |
| 文字が小さい問題の解消（全幅）                           | Task 2 (font bump) |
| X 埋め込みの左余白の解消                                 | Task 2 (`grid-column: 1 / -1`) |
| `@media (max-width: 639px)` 単一ブレークポイント         | Task 3 で導入   |
| 行の 2 段スタック化                                      | Task 3          |
| ツールバー縦積み                                         | Task 4          |
| ヘッダー / フッター padding 詰め                         | Task 5          |
| サブタイトルの ellipsis                                  | Task 5          |
| `render.ts` 不変                                         | 全タスクで遵守  |
| `web/index.html` 不変                                    | 全タスクで遵守  |
| 既存 vitest が無修正で pass                              | 各タスクの Step 2 |
| 検証マトリクス（320 / 375 / 412 / 639 / 640 / 768 / 1024 / 1440）| Task 6 Step 1 |
| ダークテーマ確認                                         | Task 6 Step 2   |
| アクセシビリティ（タップ領域 ≧ 36×36）                   | Task 6 Step 3   |

スペックの全要件をいずれかのタスクで実装または検証している。

**2. Placeholder scan:** "TBD" / "TODO" / "implement later" / "appropriate error handling" 等のフレーズ無し。各 step は具体的な CSS / コマンド / 期待出力を含む。

**3. Type consistency:** CSS のクラス名・変数名は全タスクで一貫。`.row`, `.row .text`, `.row .date`, `.row .dur`, `.row .play-btn`, `.row .embed-host`, `.toolbar`, `.sort button`, `.filter`, `.count`, `.site-header`, `.site-title`, `.site-sub`, `.site-footer` のみを使用。新しい命名は導入していない。CSS 変数 `--muted` も既存定義（`:root` および `[data-theme="dark"]`）からの参照。
