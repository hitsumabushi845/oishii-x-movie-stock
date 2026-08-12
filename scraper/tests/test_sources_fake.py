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


# --- SocialDataSource helpers ---

from scraper.sources.socialdata_source import (
    _apply_since,
    _extract_videos,
    _parse_created_at,
    SocialDataSource,
)


SAMPLE_PAGE = {
    "next_cursor": None,
    "tweets": [
        {
            "id_str": "100",
            "tweet_created_at": "2026-04-30T14:12:09.000000Z",
            "full_text": "video tweet",
            "extended_entities": {
                "media": [
                    {
                        "type": "video",
                        "media_key": "13_xxx",
                        "video_info": {"duration_millis": 194700},
                    }
                ]
            },
        },
        {
            "id_str": "200",
            "tweet_created_at": "2026-04-30T13:30:00.000000Z",
            "full_text": "photo tweet",
            "extended_entities": {
                "media": [{"type": "photo", "media_key": "3_yyy"}]
            },
        },
        {
            "id_str": "300",
            "tweet_created_at": "2026-04-30T12:00:00.000000Z",
            "full_text": "no media",
        },
    ],
}


def test_extract_videos_keeps_only_video_tweets():
    out = list(_extract_videos(SAMPLE_PAGE, "official_aimai"))
    assert [v.id for v in out] == ["100"]
    assert out[0].duration_sec == 195  # 194700 ms rounded
    assert out[0].url == "https://x.com/official_aimai/status/100"
    assert out[0].text == "video tweet"


def test_extract_videos_skips_animated_gif():
    payload = {
        "tweets": [
            {
                "id_str": "1",
                "tweet_created_at": "2026-01-01T00:00:00.000000Z",
                "full_text": "gif",
                "extended_entities": {
                    "media": [
                        {
                            "type": "animated_gif",
                            "video_info": {"variants": []},
                        }
                    ]
                },
            }
        ]
    }
    assert list(_extract_videos(payload, "u")) == []


def test_extract_videos_falls_back_to_entities_media():
    payload = {
        "tweets": [
            {
                "id_str": "5",
                "tweet_created_at": "2026-01-01T00:00:00.000000Z",
                "full_text": "v",
                "entities": {
                    "media": [
                        {"type": "video", "video_info": {"duration_millis": 5000}}
                    ]
                },
            }
        ]
    }
    out = list(_extract_videos(payload, "u"))
    assert [v.id for v in out] == ["5"]
    assert out[0].duration_sec == 5


def test_extract_videos_empty_payload():
    assert list(_extract_videos({}, "u")) == []
    assert list(_extract_videos({"tweets": []}, "u")) == []


def test_apply_since_appends_since_time_operator():
    q = _apply_since(
        "from:official_aimai filter:native_video",
        datetime(2026, 4, 28, 11, 23, 45, tzinfo=timezone.utc),
    )
    assert q == "from:official_aimai filter:native_video since_time:1777375425"


def test_apply_since_is_noop_when_none():
    assert _apply_since("from:official_aimai", None) == "from:official_aimai"


def test_parse_created_at_handles_microseconds():
    dt = _parse_created_at("2026-04-30T14:12:09.000000Z")
    assert dt.year == 2026
    assert dt.month == 4
    assert dt.tzinfo is not None
    # Compare against an explicit UTC datetime to confirm timezone handling.
    assert dt == datetime(2026, 4, 30, 14, 12, 9, tzinfo=timezone.utc)


# --- pagination ---

import httpx


@pytest.mark.asyncio
async def test_search_follows_cursor_across_pages(monkeypatch):
    async def fake_sleep(delay):
        pass

    monkeypatch.setattr("scraper.sources.socialdata_source.asyncio.sleep", fake_sleep)

    seen_cursors: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        cursor = request.url.params.get("cursor")
        seen_cursors.append(cursor)
        if cursor is None:
            return httpx.Response(
                200,
                json={
                    "next_cursor": "CURSOR2",
                    "tweets": [
                        {
                            "id_str": "1",
                            "tweet_created_at": "2026-04-30T14:00:00.000000Z",
                            "full_text": "a",
                            "extended_entities": {
                                "media": [
                                    {"type": "video", "video_info": {"duration_millis": 1000}}
                                ]
                            },
                        }
                    ],
                },
            )
        return httpx.Response(
            200,
            json={
                "next_cursor": "CURSOR3",
                "tweets": [
                    {
                        "id_str": "2",
                        "tweet_created_at": "2026-04-30T13:00:00.000000Z",
                        "full_text": "b",
                        "extended_entities": {
                            "media": [
                                {"type": "video", "video_info": {"duration_millis": 2000}}
                            ]
                        },
                    }
                ],
            },
        ) if cursor == "CURSOR2" else httpx.Response(
            200, json={"next_cursor": "CURSOR3", "tweets": []}
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    src = SocialDataSource("key", username="official_aimai", client=client)

    result = await src.fetch("q")

    assert [v.id for v in result] == ["1", "2"]
    # first page (no cursor), CURSOR2, then CURSOR3 which returns empty → stop.
    assert seen_cursors == [None, "CURSOR2", "CURSOR3"]
    await client.aclose()


@pytest.mark.asyncio
async def test_search_retries_after_429_then_succeeds(monkeypatch):
    slept: list[float] = []

    async def fake_sleep(delay):
        slept.append(delay)

    monkeypatch.setattr("scraper.sources.socialdata_source.asyncio.sleep", fake_sleep)

    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] <= 2:
            return httpx.Response(429, json={})
        return httpx.Response(200, json=SAMPLE_PAGE)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    src = SocialDataSource(
        "key", username="official_aimai", client=client, retry_base_delay_sec=1.0
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

    monkeypatch.setattr("scraper.sources.socialdata_source.asyncio.sleep", fake_sleep)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    src = SocialDataSource("key", client=client, max_retries=2, retry_base_delay_sec=0.1)

    with pytest.raises(httpx.HTTPStatusError):
        await src.fetch("q")
    await client.aclose()


@pytest.mark.asyncio
async def test_search_raises_on_insufficient_credits(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(402, json={"status": "error"})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    src = SocialDataSource("key", client=client)

    with pytest.raises(httpx.HTTPStatusError):
        await src.fetch("q")
    await client.aclose()


from scraper.sources.socialdata_source import _parse_rate_limit_headers


def test_parse_rate_limit_headers_prefers_retry_after():
    resp = httpx.Response(429, headers={"retry-after": "7"})
    assert _parse_rate_limit_headers(resp) == 7.0


def test_parse_rate_limit_headers_returns_none_when_absent():
    assert _parse_rate_limit_headers(httpx.Response(429)) is None
