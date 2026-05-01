# scraper

Collects `@official_aimai` videos and emits `data/videos.json` using the X API v2.

## Backend

X API v2 — `GET /2/tweets/search/all` with `query=from:official_aimai filter:native_video`. The `filter:native_video` predicate restricts results to tweets containing X-hosted videos, so most filtering happens server-side. We still inspect `includes.media[].type` defensively before extracting `duration_ms`.

Pagination uses `next_token`. Incremental runs add `start_time={last_synced_at}`. Backfill runs send `start_time=2010-01-01T00:00:00Z` to override search/all's default ~30-day window and get the full archive.

## Required environment

- `X_BEARER_TOKEN` — App-only Bearer Token. In CI: GitHub Secrets. Locally: `scraper/.env`.

## Local usage

```bash
uv sync
# Backfill (run once locally before first push):
set -a; source .env; set +a    # bash; for fish use a one-shot env wrapper
uv run python -m scraper \
  --data-file ../data/videos.json \
  --schema ../schema/videos.schema.json \
  --backfill

# Incremental (what CI runs):
uv run python -m scraper \
  --data-file ../data/videos.json \
  --schema ../schema/videos.schema.json
```

## Tests

```bash
uv run pytest
```

Tests do not call the live X API. The XApiSource's helper functions are exercised against fixture payloads.
