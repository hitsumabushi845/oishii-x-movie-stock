"""CLI orchestration: read existing → fetch → merge → validate → write."""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from .groups import (
    Group,
    GroupsManifest,
    ManifestError,
    build_query,
    load_manifest,
)
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

DEFAULT_QUERY = "from:official_aimai has:videos -is:retweet"
SCHEMA_POINTER = "../schema/videos.schema.json"

# search/all defaults to roughly the last 30 days when start_time is unset.
# For backfill we want the full archive, so we send an explicit early date.
BACKFILL_EPOCH = datetime(2010, 1, 1, tzinfo=timezone.utc)


def _default_source_factory(bearer: str) -> Source:
    from .sources.x_api_source import XApiSource

    return XApiSource(bearer_token=bearer)


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
    summary_label: str | None = None,
) -> int:
    existing_file = load_videos_file(data_file)

    if require_existing and (existing_file is None or existing_file.last_synced_at is None):
        print(
            "error: --require-existing was set but no existing videos.json was found",
            file=sys.stderr,
        )
        return 5

    if backfill:
        since = BACKFILL_EPOCH
    elif existing_file is None:
        since = None
    else:
        since = existing_file.last_synced_at

    try:
        fetched = await source.fetch(query, since=since)
    except Exception as e:  # noqa: BLE001
        print(f"error: source fetch failed: {e}", file=sys.stderr)
        return 2

    fetched_videos = [_to_video(v) for v in fetched]
    existing_videos = existing_file.videos if existing_file else []
    result = merge_videos(existing_videos, fetched_videos)

    if not result.content_changed and existing_file is not None:
        _emit_summary(
            summary_out, fetched_count=len(fetched), added=0, updated=0,
            changed=False, label=summary_label,
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
            summary_out, fetched_count=len(fetched),
            added=result.added, updated=result.updated, changed=True,
            label=summary_label,
        )
        return 0

    write_videos_file(data_file, new_file, schema_pointer=SCHEMA_POINTER)
    _emit_summary(
        summary_out, fetched_count=len(fetched),
        added=result.added, updated=result.updated, changed=True,
        label=summary_label,
    )
    return 0


def _to_video(v: FetchedVideo) -> Video:
    return Video(
        id=v.id, url=v.url, posted_at=v.posted_at,
        duration_sec=v.duration_sec, text=v.text, tags=[],
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
    label: str | None = None,
) -> None:
    line = (
        f"fetched={fetched_count} added={added} updated={updated} "
        f"changed={'yes' if changed else 'no'}"
    )
    print(f"[{label}] {line}" if label else line)
    if out is not None:
        with out.open("a", encoding="utf-8") as fp:
            heading = f"### scraper summary [{label}]" if label else "### scraper summary"
            fp.write(f"{heading}\n\n- {line}\n")


async def _run_for_group(
    *,
    group: Group,
    manifest_dir: Path,
    data_dir: Path,
    schema_file: Path,
    backfill: bool,
    require_existing: bool,
    dry_run: bool,
    summary_out: Path | None,
    source: Source,
) -> int:
    data_file = (data_dir / group.data_file).resolve() if data_dir else (
        manifest_dir / group.data_file
    ).resolve()
    return await run(
        source=source,
        query=build_query(group),
        data_file=data_file,
        schema_file=schema_file,
        backfill=backfill,
        require_existing=require_existing,
        dry_run=dry_run,
        summary_out=summary_out,
        summary_label=group.slug,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="scraper")

    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--group", help="manifest slug to scrape")
    mode.add_argument("--all", action="store_true", help="scrape every group in manifest")

    parser.add_argument("--manifest", type=Path, default=None,
                        help="path to data/groups.json (required with --group/--all)")
    parser.add_argument("--manifest-schema", type=Path, default=None,
                        help="path to schema/groups.schema.json (defaults to sibling of --manifest)")
    parser.add_argument("--data-dir", type=Path, default=None,
                        help="directory holding per-group data files (defaults to manifest directory)")

    parser.add_argument("--data-file", type=Path, default=None,
                        help="legacy: per-group data file (used only with --query)")
    parser.add_argument("--query", default=None, help="legacy: explicit query string")

    parser.add_argument("--schema", dest="schema_file", required=True, type=Path,
                        help="schema/videos.schema.json")
    parser.add_argument("--backfill", action="store_true")
    parser.add_argument("--require-existing", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--summary-out", type=Path, default=None)
    args = parser.parse_args(argv)

    using_manifest = args.group is not None or args.all
    using_legacy = args.query is not None or args.data_file is not None

    if using_manifest and using_legacy:
        print(
            "error: --group/--all are incompatible with legacy --query/--data-file",
            file=sys.stderr,
        )
        return 3
    if not using_manifest and not using_legacy:
        print(
            "error: must specify either --group/--all (with --manifest) or --query+--data-file",
            file=sys.stderr,
        )
        return 3
    if using_manifest and args.manifest is None:
        print("error: --manifest is required with --group/--all", file=sys.stderr)
        return 3
    if using_legacy and (args.query is None or args.data_file is None):
        print(
            "error: legacy mode requires both --query and --data-file",
            file=sys.stderr,
        )
        return 3

    bearer = os.environ.get("X_BEARER_TOKEN")
    if not bearer:
        print("error: X_BEARER_TOKEN environment variable is required", file=sys.stderr)
        return 1
    source = _default_source_factory(bearer)

    try:
        if using_legacy:
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

        manifest_schema = args.manifest_schema or (
            args.manifest.parent.parent / "schema" / "groups.schema.json"
        )
        try:
            manifest: GroupsManifest = load_manifest(args.manifest, manifest_schema)
        except ManifestError as e:
            print(f"error: manifest invalid: {e}", file=sys.stderr)
            return 3

        manifest_dir = args.manifest.parent
        data_dir = args.data_dir or manifest_dir

        if args.group is not None:
            group = manifest.find(args.group)
            return asyncio.run(
                _run_for_group(
                    group=group,
                    manifest_dir=manifest_dir,
                    data_dir=data_dir,
                    schema_file=args.schema_file,
                    backfill=args.backfill,
                    require_existing=args.require_existing,
                    dry_run=args.dry_run,
                    summary_out=args.summary_out,
                    source=source,
                )
            )

        # --all: run each group; aggregate exit codes
        async def run_all() -> int:
            failures = 0
            for g in manifest.groups:
                rc = await _run_for_group(
                    group=g,
                    manifest_dir=manifest_dir,
                    data_dir=data_dir,
                    schema_file=args.schema_file,
                    backfill=args.backfill,
                    require_existing=args.require_existing,
                    dry_run=args.dry_run,
                    summary_out=args.summary_out,
                    source=source,
                )
                if rc != 0:
                    failures += 1
            return 0 if failures == 0 else 2

        return asyncio.run(run_all())
    except KeyboardInterrupt:
        return 1


if __name__ == "__main__":
    sys.exit(main())
