# scraper

Collects videos for the OISHII.inc groups defined in `data/groups.json` and writes one `data/<slug>.json` per group via the SocialData API.

## Backend

[SocialData](https://docs.socialdata.tools) — `GET https://api.socialdata.tools/twitter/search` with `query=from:<x_handle> filter:native_video -filter:retweets`. SocialData proxies the twitter.com search, so the query uses website-search operators: `filter:native_video` restricts to X-hosted videos and `-filter:retweets` drops retweets. We still inspect `extended_entities.media[].type` defensively before extracting `video_info.duration_millis`.

Pagination follows `next_cursor` (passed back as `cursor`). Incremental runs append a `since_time:{last_synced_at}` operator to the query; backfill appends `since_time:2010-01-01` (via `BACKFILL_EPOCH`) to reach past the default recent-tweets window and get the full archive.

A 2-second sleep is inserted between paginated requests to stay under the search rate limit.

## Required environment

- `SOCIALDATA_API_KEY` — SocialData API key, sent as `Authorization: Bearer`. In CI: GitHub Secrets. Locally: `scraper/.env`.

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

Tests do not call the live SocialData API. `SocialDataSource`'s helper functions (extraction, pagination, retry, `since_time`) are exercised against fixture payloads and a mock transport, and the manifest loader / CLI flags are covered by `tests/test_groups.py` and `tests/test_cli.py`.
