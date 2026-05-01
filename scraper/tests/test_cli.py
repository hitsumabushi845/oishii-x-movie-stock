import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from scraper.cli import BACKFILL_EPOCH, run
from scraper.sources import FetchedVideo


class FakeSource:
    def __init__(self, videos: list[FetchedVideo]):
        self._videos = videos
        self.last_since: datetime | None = None

    async def fetch(self, query: str, *, since=None) -> list[FetchedVideo]:
        self.last_since = since
        if since is None:
            return list(self._videos)
        return [v for v in self._videos if v.posted_at > since]


def _schema_path() -> Path:
    return Path(__file__).resolve().parents[2] / "schema" / "videos.schema.json"


@pytest.mark.asyncio
async def test_run_writes_new_file_in_backfill_mode(tmp_path):
    data_file = tmp_path / "videos.json"
    src = FakeSource([
        FetchedVideo("1", "u1", datetime(2026, 4, 1, tzinfo=timezone.utc), 60, "a"),
        FetchedVideo("2", "u2", datetime(2026, 4, 2, tzinfo=timezone.utc), 90, "b"),
    ])
    code = await run(
        source=src,
        query="from:official_aimai has:videos -is:retweet",
        data_file=data_file,
        schema_file=_schema_path(),
        backfill=True,
        require_existing=False,
        dry_run=False,
    )
    assert code == 0
    assert data_file.exists()
    payload = json.loads(data_file.read_text())
    assert [v["id"] for v in payload["videos"]] == ["2", "1"]
    assert src.last_since == BACKFILL_EPOCH


@pytest.mark.asyncio
async def test_run_exits_5_when_require_existing_and_no_file(tmp_path):
    code = await run(
        source=FakeSource([]),
        query="q",
        data_file=tmp_path / "missing.json",
        schema_file=_schema_path(),
        backfill=False,
        require_existing=True,
        dry_run=False,
    )
    assert code == 5


@pytest.mark.asyncio
async def test_run_skips_write_when_no_content_change(tmp_path):
    data_file = tmp_path / "videos.json"
    src = FakeSource([
        FetchedVideo("1", "u1", datetime(2026, 4, 1, tzinfo=timezone.utc), 60, "a"),
    ])
    await run(
        source=src,
        query="q",
        data_file=data_file,
        schema_file=_schema_path(),
        backfill=True,
        require_existing=False,
        dry_run=False,
    )
    mtime_before = data_file.stat().st_mtime_ns
    code = await run(
        source=src,
        query="q",
        data_file=data_file,
        schema_file=_schema_path(),
        backfill=False,
        require_existing=True,
        dry_run=False,
    )
    assert code == 0
    assert data_file.stat().st_mtime_ns == mtime_before


@pytest.mark.asyncio
async def test_run_dry_run_does_not_write(tmp_path):
    data_file = tmp_path / "videos.json"
    src = FakeSource([
        FetchedVideo("1", "u1", datetime(2026, 4, 1, tzinfo=timezone.utc), 60, "a"),
    ])
    code = await run(
        source=src,
        query="q",
        data_file=data_file,
        schema_file=_schema_path(),
        backfill=True,
        require_existing=False,
        dry_run=True,
    )
    assert code == 0
    assert not data_file.exists()
