"""CLI orchestration: read existing → fetch → merge → validate → write."""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

from .io_ import (
    SchemaValidationError,
    load_videos_file,
    utc_now,
    validate_against_schema,
    write_videos_file,
)
from .merge import merge_videos
from .models import Video, VideosFile
from .sources import FetchedVideo, Source

DEFAULT_QUERY = "from:official_aimai filter:native_video"
SCHEMA_POINTER = "../schema/videos.schema.json"


async def run(
    *,
    source: Source,
    query: str,
    data_file: Path,
    schema_file: Path,
    backfill: bool,
    require_existing: bool,
    dry_run: bool,
    summary_out: Path | None = None,
) -> int:
    existing_file = load_videos_file(data_file)

    if require_existing and (existing_file is None or existing_file.last_synced_at is None):
        print(
            "error: --require-existing was set but no existing videos.json was found",
            file=sys.stderr,
        )
        return 5

    since = None if backfill or existing_file is None else existing_file.last_synced_at

    try:
        fetched = await source.fetch(query, since=since)
    except Exception as e:  # noqa: BLE001 — broad on purpose, mapped to exit 2
        print(f"error: source fetch failed: {e}", file=sys.stderr)
        return 2

    fetched_videos = [_to_video(v) for v in fetched]
    existing_videos = existing_file.videos if existing_file else []
    result = merge_videos(existing_videos, fetched_videos)

    if not result.content_changed and existing_file is not None:
        _emit_summary(
            summary_out, fetched_count=len(fetched), added=0, updated=0, changed=False
        )
        return 0

    new_max = result.max_posted_at or (
        existing_file.last_synced_at if existing_file else utc_now()
    )
    new_file = VideosFile(
        generated_at=utc_now(),
        last_synced_at=new_max,
        source_query=query,
        videos=result.videos,
    )

    payload_dict = _to_payload(new_file)
    try:
        validate_against_schema(payload_dict, schema_file)
    except SchemaValidationError as e:
        print(f"error: schema validation failed: {e}", file=sys.stderr)
        return 4

    if dry_run:
        print(
            f"[dry-run] would write {len(new_file.videos)} videos "
            f"(added={result.added}, updated={result.updated})"
        )
        _emit_summary(
            summary_out,
            fetched_count=len(fetched),
            added=result.added,
            updated=result.updated,
            changed=True,
        )
        return 0

    write_videos_file(data_file, new_file, schema_pointer=SCHEMA_POINTER)
    _emit_summary(
        summary_out,
        fetched_count=len(fetched),
        added=result.added,
        updated=result.updated,
        changed=True,
    )
    return 0


def _to_video(v: FetchedVideo) -> Video:
    return Video(
        id=v.id,
        url=v.url,
        posted_at=v.posted_at,
        duration_sec=v.duration_sec,
        text=v.text,
        tags=[],
    )


def _to_payload(f: VideosFile) -> dict:
    import json

    return json.loads(f.model_dump_json())


def _emit_summary(
    out: Path | None,
    *,
    fetched_count: int,
    added: int,
    updated: int,
    changed: bool,
) -> None:
    line = (
        f"fetched={fetched_count} added={added} updated={updated} "
        f"changed={'yes' if changed else 'no'}"
    )
    print(line)
    if out is not None:
        with out.open("a", encoding="utf-8") as fp:
            fp.write(f"### scraper summary\n\n- {line}\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="scraper")
    parser.add_argument("--data-file", required=True, type=Path)
    parser.add_argument("--schema", dest="schema_file", required=True, type=Path)
    parser.add_argument("--backfill", action="store_true")
    parser.add_argument("--require-existing", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--summary-out", type=Path, default=None)
    parser.add_argument("--query", default=DEFAULT_QUERY)
    args = parser.parse_args(argv)

    bearer = os.environ.get("X_BEARER_TOKEN")
    if not bearer:
        print(
            "error: X_BEARER_TOKEN environment variable is required",
            file=sys.stderr,
        )
        return 1
    from .sources.x_api_source import XApiSource

    source = XApiSource(bearer_token=bearer)

    try:
        return asyncio.run(
            run(
                source=source,
                query=args.query,
                data_file=args.data_file,
                schema_file=args.schema_file,
                backfill=args.backfill,
                require_existing=args.require_existing,
                dry_run=args.dry_run,
                summary_out=args.summary_out,
            )
        )
    except KeyboardInterrupt:
        return 1


if __name__ == "__main__":
    sys.exit(main())
