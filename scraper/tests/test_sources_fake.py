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


# --- XApiSource helpers ---

from scraper.sources.x_api_source import _extract_videos, XApiSource, _parse_created_at


SAMPLE_PAGE = {
    "data": [
        {
            "id": "100",
            "created_at": "2026-04-30T14:12:09.000Z",
            "text": "video tweet",
            "attachments": {"media_keys": ["13_xxx"]},
        },
        {
            "id": "200",
            "created_at": "2026-04-30T13:30:00.000Z",
            "text": "photo tweet",
            "attachments": {"media_keys": ["3_yyy"]},
        },
        {
            "id": "300",
            "created_at": "2026-04-30T12:00:00.000Z",
            "text": "no media",
        },
    ],
    "includes": {
        "media": [
            {"media_key": "13_xxx", "type": "video", "duration_ms": 194700},
            {"media_key": "3_yyy", "type": "photo"},
        ]
    },
}


def test_extract_videos_keeps_only_video_tweets():
    out = list(_extract_videos(SAMPLE_PAGE, "official_aimai"))
    assert [v.id for v in out] == ["100"]
    assert out[0].duration_sec == 195  # 194700 ms rounded
    assert out[0].url == "https://x.com/official_aimai/status/100"
    assert out[0].text == "video tweet"


def test_extract_videos_ignores_unknown_media_keys():
    payload = {
        "data": [
            {
                "id": "1",
                "created_at": "2026-01-01T00:00:00Z",
                "text": "x",
                "attachments": {"media_keys": ["missing"]},
            }
        ],
        "includes": {"media": []},
    }
    assert list(_extract_videos(payload, "u")) == []


def test_extract_videos_empty_payload():
    assert list(_extract_videos({}, "u")) == []
    assert list(_extract_videos({"data": []}, "u")) == []


def test_format_start_time_uses_z_suffix():
    out = XApiSource._format_start_time(
        datetime(2026, 4, 28, 11, 23, 45, tzinfo=timezone.utc)
    )
    assert out == "2026-04-28T11:23:45Z"


def test_parse_created_at_handles_milliseconds():
    dt = _parse_created_at("2026-04-30T14:12:09.000Z")
    assert dt.year == 2026
    assert dt.month == 4
    assert dt.tzinfo is not None
    # Compare against an explicit UTC datetime to confirm timezone handling.
    assert dt == datetime(2026, 4, 30, 14, 12, 9, tzinfo=timezone.utc)


# --- 429 retry / backoff ---

import httpx

from scraper.sources.x_api_source import _parse_rate_limit_headers


@pytest.mark.asyncio
async def test_search_retries_after_429_then_succeeds(monkeypatch):
    slept: list[float] = []

    async def fake_sleep(delay):
        slept.append(delay)

    monkeypatch.setattr("scraper.sources.x_api_source.asyncio.sleep", fake_sleep)

    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] <= 2:
            return httpx.Response(429, json={})
        return httpx.Response(200, json=SAMPLE_PAGE)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    src = XApiSource(
        "token", username="official_aimai", client=client, retry_base_delay_sec=1.0
    )

    result = await src.fetch("q")

    assert calls["n"] == 3  # two 429s, then a 200
    assert [v.id for v in result] == ["100"]
    # Exponential backoff: base * 2**0, base * 2**1.
    assert slept == [1.0, 2.0]
    await client.aclose()


@pytest.mark.asyncio
async def test_search_gives_up_after_max_retries(monkeypatch):
    async def fake_sleep(delay):
        pass

    monkeypatch.setattr("scraper.sources.x_api_source.asyncio.sleep", fake_sleep)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    src = XApiSource("token", client=client, max_retries=2, retry_base_delay_sec=0.1)

    with pytest.raises(httpx.HTTPStatusError):
        await src.fetch("q")
    await client.aclose()


def test_parse_rate_limit_headers_prefers_retry_after():
    resp = httpx.Response(429, headers={"retry-after": "7"})
    assert _parse_rate_limit_headers(resp) == 7.0


def test_parse_rate_limit_headers_returns_none_when_absent():
    assert _parse_rate_limit_headers(httpx.Response(429)) is None
