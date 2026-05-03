# Google Analytics Design

- Date: 2026-05-03
- Scope: `web/` のみ（scraper / data / workflows は対象外）
- Status: approved (brainstorm)

## 目的

`aimai-x-movie-stock` の公開サイトに Google Analytics (GA4 / Measurement ID `G-JPZZP8M3SR`) を導入し、本番環境（GitHub Pages）でのページビューを計測できるようにする。タグ自体は既に GA 側で発行済みのものを使用する。

## 非目的（YAGNI）

- カスタムイベント送信。まずは標準のページビュー計測のみ。
- Cookie 同意バナー / GDPR 対応 UI。当サイトの規模・用途と既存方針（`README.md` 上の "unofficial fan-made index"）を踏まえ、初期リリースでは導入しない。必要になったら別スコープで再設計する。
- Measurement ID の環境変数化（`.env`）。ID は公開情報であり HTML/JS にそのまま埋め込んでも秘匿性のリスクは無いため、定数として直接コードに置く。
- Google Tag Manager (GTM) 経由の導入。直接 `gtag.js` を使う方が依存もコード量も少ない。
- ローカル開発・Vitest 実行時のページビュー送信。本番ビルドのみで有効化する。

## 設計概要

### アプローチ

`web/index.html` には書かず、新規モジュール `web/src/analytics.ts` から動的に GA タグを注入する。`web/src/main.ts` の `bootstrap()` 内で `initTheme()` の隣に `initAnalytics()` を呼び出す。

```ts
// web/src/analytics.ts (擬似コード)
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

const MEASUREMENT_ID = "G-JPZZP8M3SR";

export function initAnalytics(): void {
  if (!import.meta.env.PROD) return;

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID);
}

export {}; // for declare global
```

### なぜこの形

- **`import.meta.env.PROD` ガード**: Vite はビルド時に `import.meta.env.PROD` をリテラル `true` / `false` に置換するため、`make web-dev` や Vitest 実行時には `if (false) return;` の dead code として最終的に GA コードごと tree-shake される。実行時の判定ではなくビルド時除去になる点が重要。
- **既存パターン踏襲**: `theme.ts` の `initTheme()` と同じ粒度で、`main.ts` の `bootstrap()` から1関数を呼ぶだけ。新しい構造を持ち込まない。
- **`index.html` に直書きしない**: dev サーバ（`make web-dev` / `vite`）で起動した時のページビューを本番計測に混入させないため。
- **`declare global` で型を当てる**: `@types/gtag.js` のような追加依存を避けつつ、`@ts-expect-error` の連発を防ぐ。`gtag` / `dataLayer` の最低限の型を `Window` に直接生やす。
- **`MEASUREMENT_ID` を定数化**: ID 文字列の散在を避けるためモジュール先頭で一度だけ宣言する。

### 呼び出し位置

`web/src/main.ts` の `bootstrap()` 関数の冒頭、`initTheme()` 直後で `initAnalytics()` を呼ぶ。ページが描画される前に `gtag('config', ...)` が走ることで、初回ページビューは確実に計測される。SPA 的な画面遷移は無いため `page_view` の手動送信は不要（`gtag('config', ...)` が自動発火する）。

## テスト戦略

新規テストは追加しない。理由：

- ガードは `if (!import.meta.env.PROD) return;` の1行のみ。これをテストするには `import.meta.env.PROD` をモックして DOM を検証することになるが、Vitest 環境では常に `PROD=false` のため `initAnalytics()` は何もしない。逆方向（PROD 時に script タグが挿入されること）をテストするのは GA スニペット自体の再実装になる。
- 既存の `web/tests/` は副作用ゼロで通る（`import.meta.env.PROD` が `false` のため `initAnalytics()` は早期 return する）。

確認は以下の手動チェックで十分：

1. `make web-dev` で起動 → DevTools Network タブで `googletagmanager.com` へのリクエストが **無い** ことを確認
2. `pnpm -F web build && pnpm -F web preview` で本番ビルドをローカル確認 → Network に `gtag/js?id=G-JPZZP8M3SR` が出ること、`Realtime` レポートが GA で見えること
3. `make test` が引き続き通る

## 影響範囲

| ファイル | 変更内容 |
| --- | --- |
| `web/src/analytics.ts` | 新規作成 |
| `web/src/main.ts` | `import { initAnalytics } from "./analytics.js";` を追加し、`bootstrap()` 内で呼び出す |
| `web/index.html` | 変更なし |
| `web/package.json` | 変更なし（追加依存なし） |
| `scraper/`, `data/`, `schema/`, `.github/` | 変更なし |

## リスク・考慮事項

- **アドブロッカー**: 一部のユーザは GA リクエストをブロックする。これは仕様であり受け入れる。
- **`gtag` の TypeScript 型**: `arguments` 暗黙オブジェクトを `dataLayer.push(arguments)` で push する古典的パターンのため、`function () {}` 形式（アロー関数ではなく）を維持する必要がある。本リポジトリには ESLint 設定が無いため lint 例外指定は不要。
- **PR プレビュー**: 本リポジトリは GitHub Pages の単一環境のみで、PR プレビュー環境は持たない。`PROD` ガードだけで十分。
