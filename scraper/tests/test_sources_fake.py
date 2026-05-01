from datetime import datetime, timezone
import pytest

from scraper.sources import Source, FetchedVideo


class FakeSource:
    def __init__(self, videos: list[FetchedVideo]):
        self._videos = videos
        self.last_query: str | None = None
        self.last_since: datetime | None = None

    async def fetch(self, query: str, *, since: datetime | None = None) -> list[FetchedVideo]:
        self.last_query = query
        self.last_since = since
        if since is None:
            return list(self._videos)
        return [v for v in self._videos if v.posted_at > since]


@pytest.mark.asyncio
async def test_fake_source_returns_all_when_since_is_none():
    src: Source = FakeSource([
        FetchedVideo("1", "u", datetime(2026, 1, 1, tzinfo=timezone.utc), 10, "t"),
    ])
    result = await src.fetch("q")
    assert len(result) == 1


@pytest.mark.asyncio
async def test_fake_source_filters_by_since():
    s = FakeSource([
        FetchedVideo("1", "u", datetime(2026, 1, 1, tzinfo=timezone.utc), 10, "t"),
        FetchedVideo("2", "u", datetime(2026, 2, 1, tzinfo=timezone.utc), 10, "t"),
    ])
    result = await s.fetch("q", since=datetime(2026, 1, 15, tzinfo=timezone.utc))
    assert [v.id for v in result] == ["2"]
