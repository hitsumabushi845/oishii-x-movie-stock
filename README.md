# aimai-x-movie-stock

`@official_aimai` の投稿動画（特にライブダイジェスト）を一覧表示する静的サイト。

- ホスティング: GitHub Pages
- 更新: GitHub Actions の週次 cron で `data/videos.json` を更新する PR が立つ
- データ取得: `scraper/`（Python）
- フロント: `web/`（Vite + TypeScript）

詳細な設計: [`docs/superpowers/specs/2026-05-01-aimai-movie-stock-design.md`](docs/superpowers/specs/2026-05-01-aimai-movie-stock-design.md)

> This site is an unofficial fan-made index. All content belongs to its respective owners.
