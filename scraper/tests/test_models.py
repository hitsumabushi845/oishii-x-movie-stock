from datetime import datetime, timezone
import pytest
from pydantic import ValidationError
from scraper.models import Video, VideosFile


def test_video_minimal_valid():
    v = Video(
        id="1234567890",
        url="https://x.com/official_aimai/status/1234567890",
        posted_at=datetime(2026, 4, 1, 12, 0, tzinfo=timezone.utc),
        duration_sec=90,
        text="hello",
        tags=[],
    )
    assert v.id == "1234567890"
    assert v.duration_sec == 90


def test_video_id_must_be_numeric_string():
    with pytest.raises(ValidationError):
        Video(
            id="not-numeric",
            url="https://x.com/official_aimai/status/1",
            posted_at=datetime.now(timezone.utc),
            duration_sec=1,
            text="x",
            tags=[],
        )


def test_video_duration_non_negative():
    with pytest.raises(ValidationError):
        Video(
            id="1",
            url="https://x.com/official_aimai/status/1",
            posted_at=datetime.now(timezone.utc),
            duration_sec=-1,
            text="x",
            tags=[],
        )


def test_videos_file_minimal_valid():
    f = VideosFile(
        generated_at=datetime(2026, 5, 1, tzinfo=timezone.utc),
        last_synced_at=datetime(2026, 4, 30, tzinfo=timezone.utc),
        source_query="from:official_aimai filter:native_video",
        videos=[],
    )
    assert f.videos == []
