# scraper

Collects videos for the OISHII.inc groups defined in `data/groups.json` and writes one `data/<slug>.json` per group via the X API v2.

## Backend

X API v2 — `GET /2/tweets/search/all` with `query=from:<x_handle> has:videos -is:retweet`. The `has:videos` predicate restricts results to tweets containing X-hosted videos (the `filter:native_video` predicate is not available on the dev tier). We still inspect `includes.media[].type` defensively before extracting `duration_ms`.

Pagination uses `next_token`. Incremental runs add `start_time={last_synced_at}`. Backfill runs send `start_time=2010-01-01T00:00:00Z` to override search/all's default ~30-day window and get the full archive.

A 2-second sleep is inserted between paginated requests to stay under the search/all rate limit on the dev tier.

## Required environment

- `X_BEARER_TOKEN` — App-only Bearer Token. In CI: GitHub Secrets. Locally: `scraper/.env`.

## Local usage (manifest mode)

The CLI is driven by the manifest at `data/groups.json`. Pick `--group <slug>` for a single group or `--all` for every group in the manifest.

```bash
uv sync

# Backfill one group (run once locally before first push):
set -a; source .env; set +a    # bash; for fish use the recipes in the top-level README
uv run python -m scraper --group aimai \
  --manifest ../data/groups.json \
  --manifest-schema ../schema/groups.schema.json \
  --schema ../schema/videos.schema.json \
  --data-dir ../data \
  --backfill

# Backfill every group:
uv run python -m scraper --all \
  --manifest ../data/groups.json \
  --manifest-schema ../schema/groups.schema.json \
  --schema ../schema/videos.schema.json \
  --data-dir ../data \
  --backfill

# Incremental (what CI runs, fails if the per-group file is missing):
uv run python -m scraper --group aimai \
  --manifest ../data/groups.json \
  --manifest-schema ../schema/groups.schema.json \
  --schema ../schema/videos.schema.json \
  --data-dir ../data \
  --require-existing
```

`--data-dir` resolves each group's `data_file` from the manifest entry, so output paths follow whatever the manifest says (currently `data/aimai.json` / `data/shokuzai.json` / `data/mizutama.json`).

## Tests

```bash
uv run pytest
```

Tests do not call the live X API. The XApiSource's helper functions are exercised against fixture payloads, and the manifest loader / CLI flags are covered by `tests/test_groups.py` and `tests/test_cli.py`.
