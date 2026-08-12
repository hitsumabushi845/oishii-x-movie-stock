"""SocialData API backed implementation of Source (twitter/search).

SocialData (https://socialdata.tools) proxies the Twitter/X website search, so
queries use the same operators as the twitter.com search box (``filter:native_video``,
``-filter:retweets``, ``since_time:<unix>``) rather than the X API v2 operators.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any, Iterator

import httpx

from .base import FetchedVideo

SEARCH_URL = "https://api.socialdata.tools/twitter/search"
DEFAULT_USERNAME = "official_aimai"
DEFAULT_PAGE_DELAY_SEC = 2.0
DEFAULT_MAX_RETRIES = 5
DEFAULT_RETRY_BASE_DELAY_SEC = 5.0
# Cap any single backoff wait so a bogus reset header can't stall the job.
MAX_RETRY_DELAY_SEC = 120.0


class SocialDataSource:
    """Fetch native videos via the SocialData ``twitter/search`` endpoint.

    The search query (typically ``from:{username} filter:native_video
    -filter:retweets``) is passed in by the caller. The username is kept here
    only to construct canonical tweet URLs in the result; no user lookup is
    performed. When ``since`` is given, a ``since_time:<unix>`` operator is
    appended to the query — SocialData has no dedicated start-time parameter.
    """

    def __init__(
        self,
        api_key: str,
        *,
        username: str = DEFAULT_USERNAME,
        client: httpx.AsyncClient | None = None,
        page_delay_sec: float = DEFAULT_PAGE_DELAY_SEC,
        max_retries: int = DEFAULT_MAX_RETRIES,
        retry_base_delay_sec: float = DEFAULT_RETRY_BASE_DELAY_SEC,
    ) -> None:
        self._api_key = api_key
        self._username = username
        self._client = client
        self._page_delay_sec = page_delay_sec
        self._max_retries = max_retries
        self._retry_base_delay_sec = retry_base_delay_sec

    async def fetch(
        self, query: str, *, since: datetime | None = None
    ) -> list[FetchedVideo]:
        async with self._maybe_owned_client() as client:
            return await self._search(client, query, since)

    def _maybe_owned_client(self) -> "_ClientCtx":
        if self._client is not None:
            return _ClientCtx.shared(self._client)
        owned = httpx.AsyncClient(
            headers=self._auth_headers(),
            timeout=30.0,
        )
        return _ClientCtx.owned(owned)

    async def _search(
        self,
        client: httpx.AsyncClient,
        query: str,
        since: datetime | None,
    ) -> list[FetchedVideo]:
        base_params: dict[str, Any] = {
            "query": _apply_since(query, since),
            "type": "Latest",
        }

        out: list[FetchedVideo] = []
        cursor: str | None = None
        while True:
            page_params = dict(base_params)
            if cursor:
                page_params["cursor"] = cursor
            r = await self._get_with_retry(client, page_params)
            payload = r.json()
            out.extend(_extract_videos(payload, self._username))
            cursor = payload.get("next_cursor")
            tweets = payload.get("tweets") or []
            # Stop when the API stops handing back a cursor, or when a page comes
            # back empty (a lingering cursor would otherwise loop forever).
            if not cursor or not tweets:
                break
            # Sleep between pages to stay under the search rate limit.
            await asyncio.sleep(self._page_delay_sec)
        return out

    async def _get_with_retry(
        self, client: httpx.AsyncClient, page_params: dict[str, Any]
    ) -> httpx.Response:
        """GET a page, backing off and retrying on 429 (rate limited).

        Honors the server's ``Retry-After`` / ``x-rate-limit-reset`` hint when
        present, otherwise falls back to exponential backoff. Other HTTP errors
        (402 insufficient credits, 422 validation, 5xx, ...) raise immediately.
        """
        attempt = 0
        while True:
            r = await client.get(
                SEARCH_URL, params=page_params, headers=self._auth_headers()
            )
            if r.status_code != 429 or attempt >= self._max_retries:
                r.raise_for_status()
                return r
            await asyncio.sleep(self._retry_delay(r, attempt))
            attempt += 1

    def _retry_delay(self, response: httpx.Response, attempt: int) -> float:
        """Seconds to wait before retrying a 429, from headers or backoff."""
        hinted = _parse_rate_limit_headers(response)
        if hinted is not None:
            delay = hinted
        else:
            delay = self._retry_base_delay_sec * (2**attempt)
        return min(max(delay, 0.0), MAX_RETRY_DELAY_SEC)

    def _auth_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Accept": "application/json",
        }


def _apply_since(query: str, since: datetime | None) -> str:
    """Append a ``since_time:<unix>`` operator when an incremental cutoff is set."""
    if since is None:
        return query
    epoch = int(since.astimezone(timezone.utc).timestamp())
    return f"{query} since_time:{epoch}"


def _extract_videos(payload: dict[str, Any], username: str) -> Iterator[FetchedVideo]:
    """Yield FetchedVideo for each tweet in the page that has a native video.

    Server-side ``filter:native_video`` should already restrict results to
    video tweets, but the type check is kept defensively — a query can still
    surface photos or animated GIFs, and only ``type == "video"`` carries a
    real ``duration_millis``.
    """
    tweets = payload.get("tweets") or []
    for tweet in tweets:
        videos = [m for m in _media_list(tweet) if m.get("type") == "video"]
        if not videos:
            continue
        first = videos[0]
        duration_ms = int((first.get("video_info") or {}).get("duration_millis") or 0)
        tweet_id = str(tweet["id_str"])
        yield FetchedVideo(
            id=tweet_id,
            url=f"https://x.com/{username}/status/{tweet_id}",
            posted_at=_parse_created_at(tweet["tweet_created_at"]),
            duration_sec=round(duration_ms / 1000),
            text=tweet.get("full_text") or tweet.get("text") or "",
        )


def _media_list(tweet: dict[str, Any]) -> list[dict[str, Any]]:
    """Media for a tweet, preferring ``extended_entities`` (holds video info)."""
    extended = (tweet.get("extended_entities") or {}).get("media")
    if extended:
        return extended
    return (tweet.get("entities") or {}).get("media") or []


def _parse_rate_limit_headers(response: httpx.Response) -> float | None:
    """Extract a wait, in seconds, from rate-limit headers (None if absent).

    ``Retry-After`` is a delta in seconds; ``x-rate-limit-reset`` is an epoch
    timestamp from which we derive the remaining wait.
    """
    retry_after = response.headers.get("retry-after")
    if retry_after:
        try:
            return float(retry_after)
        except ValueError:
            pass
    reset = response.headers.get("x-rate-limit-reset")
    if reset:
        try:
            return float(reset) - time.time()
        except ValueError:
            pass
    return None


def _parse_created_at(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


class _ClientCtx:
    def __init__(self, client: httpx.AsyncClient, owned: bool) -> None:
        self._client = client
        self._owned = owned

    @classmethod
    def owned(cls, client: httpx.AsyncClient) -> "_ClientCtx":
        return cls(client, True)

    @classmethod
    def shared(cls, client: httpx.AsyncClient) -> "_ClientCtx":
        return cls(client, False)

    async def __aenter__(self) -> httpx.AsyncClient:
        return self._client

    async def __aexit__(self, *exc_info) -> None:
        if self._owned:
            await self._client.aclose()
