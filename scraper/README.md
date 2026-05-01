# scraper

Collects `@official_aimai` videos and emits `data/videos.json` using the X API v2.

## Backend

X API v2 — `GET /2/users/{user_id}/tweets` with media expansion (`expansions=attachments.media_keys`, `media.fields=type,duration_ms`). Native videos are kept; photos / animated_gifs / non-media tweets are filtered out.

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
