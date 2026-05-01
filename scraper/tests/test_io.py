from datetime import datetime, timezone
from pathlib import Path
import json
import pytest

from scraper.io_ import (
    load_videos_file,
    write_videos_file,
    validate_against_schema,
    SchemaValidationError,
)
from scraper.models import VideosFile, Video


def test_load_videos_file_returns_typed_object(fixtures_dir):
    f = load_videos_file(fixtures_dir / "sample_videos.json")
    assert isinstance(f, VideosFile)
    assert len(f.videos) == 1
    assert f.videos[0].id == "1789012345678901234"


def test_load_missing_file_returns_none(tmp_path):
    assert load_videos_file(tmp_path / "missing.json") is None


def test_write_round_trip(tmp_path, fixtures_dir):
    src = load_videos_file(fixtures_dir / "sample_videos.json")
    out = tmp_path / "out.json"
    write_videos_file(out, src)
    reloaded = load_videos_file(out)
    assert reloaded.model_dump() == src.model_dump()


def test_write_serializes_datetimes_with_z(tmp_path):
    f = VideosFile(
        generated_at=datetime(2026, 5, 1, tzinfo=timezone.utc),
        last_synced_at=datetime(2026, 4, 30, tzinfo=timezone.utc),
        source_query="q",
        videos=[],
    )
    out = tmp_path / "x.json"
    write_videos_file(out, f)
    text = out.read_text(encoding="utf-8")
    assert "2026-05-01T00:00:00Z" in text


def test_write_includes_schema_pointer(tmp_path):
    f = VideosFile(
        generated_at=datetime(2026, 5, 1, tzinfo=timezone.utc),
        last_synced_at=datetime(2026, 5, 1, tzinfo=timezone.utc),
        source_query="q",
        videos=[],
    )
    out = tmp_path / "x.json"
    write_videos_file(out, f, schema_pointer="../schema/videos.schema.json")
    raw = json.loads(out.read_text(encoding="utf-8"))
    assert raw["$schema"] == "../schema/videos.schema.json"


def test_validate_against_schema_passes(fixtures_dir, schema_path):
    payload = json.loads((fixtures_dir / "sample_videos.json").read_text(encoding="utf-8"))
    validate_against_schema(payload, schema_path)


def test_validate_against_schema_rejects_bad_id(schema_path):
    payload = {
        "generated_at": "2026-05-01T00:00:00Z",
        "last_synced_at": "2026-05-01T00:00:00Z",
        "source_query": "q",
        "videos": [
            {
                "id": "not-numeric",
                "url": "https://x.com/official_aimai/status/1",
                "posted_at": "2026-05-01T00:00:00Z",
                "duration_sec": 1,
                "text": "x",
                "tags": [],
            }
        ],
    }
    with pytest.raises(SchemaValidationError):
        validate_against_schema(payload, schema_path)
