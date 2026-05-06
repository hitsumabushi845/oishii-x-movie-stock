import io
import json
import json as _json
from contextlib import redirect_stderr
from datetime import datetime, timezone
from pathlib import Path

import pytest

from scraper.cli import BACKFILL_EPOCH, run
from scraper.cli import main as cli_main
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


def _write_groups_manifest(tmp_path: Path) -> Path:
    payload = {
        "groups": [
            {
                "slug": "aimai",
                "display_name": "Aimai",
                "x_handle": "official_aimai",
                "data_file": "aimai.json",
                "color": "#bc2956",
            },
            {
                "slug": "shokuzai",
                "display_name": "Shokuzai",
                "x_handle": "ofc_shokuzai",
                "data_file": "shokuzai.json",
                "color": "#1A1A1A",
            },
        ]
    }
    p = tmp_path / "groups.json"
    p.write_text(_json.dumps(payload), encoding="utf-8")
    return p


def _groups_schema_path() -> Path:
    return Path(__file__).resolve().parents[2] / "schema" / "groups.schema.json"


def test_run_with_group_resolves_handle_into_query(tmp_path, monkeypatch):
    """When invoked with --group, the CLI must resolve the manifest into the
    correct query string and write to data/<slug>.json."""
    from scraper import cli as cli_module

    captured: dict[str, object] = {}

    class CapturingSource:
        async def fetch(self, query, *, since=None):
            captured["query"] = query
            captured["since"] = since
            return [
                FetchedVideo(
                    "1", "u1",
                    datetime(2026, 4, 1, tzinfo=timezone.utc), 60, "x",
                ),
            ]

    def fake_factory(_token: str) -> CapturingSource:
        return CapturingSource()

    monkeypatch.setattr(cli_module, "_default_source_factory", fake_factory)
    monkeypatch.setenv("X_BEARER_TOKEN", "dummy")

    manifest = _write_groups_manifest(tmp_path)
    data_dir = tmp_path
    code = cli_main([
        "--group", "shokuzai",
        "--manifest", str(manifest),
        "--data-dir", str(data_dir),
        "--manifest-schema", str(_groups_schema_path()),
        "--schema", str(_schema_path()),
        "--backfill",
    ])
    assert code == 0
    assert captured["query"] == "from:ofc_shokuzai has:videos -is:retweet"
    assert (data_dir / "shokuzai.json").exists()


def test_run_with_group_and_legacy_query_is_rejected(tmp_path, monkeypatch):
    monkeypatch.setenv("X_BEARER_TOKEN", "dummy")
    manifest = _write_groups_manifest(tmp_path)
    err = io.StringIO()
    with redirect_stderr(err):
        code = cli_main([
            "--group", "aimai",
            "--manifest", str(manifest),
            "--manifest-schema", str(_groups_schema_path()),
            "--data-dir", str(tmp_path),
            "--schema", str(_schema_path()),
            "--query", "extra-query",
        ])
    assert code == 3
    assert "--query" in err.getvalue() or "incompatible" in err.getvalue().lower()


def test_run_with_all_iterates_all_groups(tmp_path, monkeypatch):
    from scraper import cli as cli_module

    seen: list[str] = []

    class TrackingSource:
        async def fetch(self, query, *, since=None):
            seen.append(query)
            return [
                FetchedVideo(
                    "1", "u1",
                    datetime(2026, 4, 1, tzinfo=timezone.utc), 60, "x",
                ),
            ]

    monkeypatch.setattr(cli_module, "_default_source_factory", lambda _t: TrackingSource())
    monkeypatch.setenv("X_BEARER_TOKEN", "dummy")
    manifest = _write_groups_manifest(tmp_path)
    code = cli_main([
        "--all",
        "--manifest", str(manifest),
        "--manifest-schema", str(_groups_schema_path()),
        "--data-dir", str(tmp_path),
        "--schema", str(_schema_path()),
        "--backfill",
    ])
    assert code == 0
    assert seen == [
        "from:official_aimai has:videos -is:retweet",
        "from:ofc_shokuzai has:videos -is:retweet",
    ]
    assert (tmp_path / "aimai.json").exists()
    assert (tmp_path / "shokuzai.json").exists()


def test_run_with_all_continues_after_one_group_fails(tmp_path, monkeypatch):
    from scraper import cli as cli_module

    calls: list[str] = []

    class FlakySource:
        async def fetch(self, query, *, since=None):
            calls.append(query)
            if "official_aimai" in query:
                raise RuntimeError("boom")
            return [
                FetchedVideo(
                    "1", "u1",
                    datetime(2026, 4, 1, tzinfo=timezone.utc), 60, "x",
                ),
            ]

    monkeypatch.setattr(cli_module, "_default_source_factory", lambda _t: FlakySource())
    monkeypatch.setenv("X_BEARER_TOKEN", "dummy")
    manifest = _write_groups_manifest(tmp_path)
    code = cli_main([
        "--all",
        "--manifest", str(manifest),
        "--manifest-schema", str(_groups_schema_path()),
        "--data-dir", str(tmp_path),
        "--schema", str(_schema_path()),
        "--backfill",
    ])
    # 1 group failed → exit 2 (non-zero)
    assert code == 2
    assert len(calls) == 2
    # Successful group's file is written even though a sibling failed
    assert (tmp_path / "shokuzai.json").exists()
    assert not (tmp_path / "aimai.json").exists()
