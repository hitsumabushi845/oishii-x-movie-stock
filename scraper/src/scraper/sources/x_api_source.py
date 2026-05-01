"""X API v2 backed implementation of Source (search/all)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterator

import httpx

from .base import FetchedVideo

SEARCH_ALL_URL = "https://api.twitter.com/2/tweets/search/all"
DEFAULT_USERNAME = "official_aimai"


class XApiSource:
    """Fetch native videos via X API v2 search/all.

    The search query (typically `from:{username} filter:native_video`) is
    passed in by the caller. The username is kept here only to construct
    canonical tweet URLs in the result; no user lookup is performed.
    """

    def __init__(
        self,
        bearer_token: str,
        *,
        username: str = DEFAULT_USERNAME,
        client: httpx.AsyncClient | None = None,
        page_size: int = 100,
    ) -> None:
        self._bearer = bearer_token
        self._username = username
        self._client = client
        self._page_size = page_size

    async def fetch(
        self, query: str, *, since: datetime | None = None
    ) -> list[FetchedVideo]:
        async with self._maybe_owned_client() as client:
            return await self._search(client, query, since)

    def _maybe_owned_client(self) -> "_ClientCtx":
        if self._client is not None:
            return _ClientCtx.shared(self._client)
        owned = httpx.AsyncClient(
            headers={"Authorization": f"Bearer {self._bearer}"},
            timeout=30.0,
        )
        return _ClientCtx.owned(owned)

    async def _search(
        self,
        client: httpx.AsyncClient,
        query: str,
        since: datetime | None,
    ) -> list[FetchedVideo]:
        params: dict[str, Any] = {
            "query": query,
            "max_results": self._page_size,
            "tweet.fields": "created_at,text,attachments",
            "expansions": "attachments.media_keys",
            "media.fields": "type,duration_ms",
        }
        if since is not None:
            params["start_time"] = self._format_start_time(since)

        out: list[FetchedVideo] = []
        next_token: str | None = None
        while True:
            page_params = dict(params)
            if next_token:
                page_params["pagination_token"] = next_token
            r = await client.get(SEARCH_ALL_URL, params=page_params, headers=self._auth_headers())
            r.raise_for_status()
            payload = r.json()
            out.extend(_extract_videos(payload, self._username))
            next_token = payload.get("meta", {}).get("next_token")
            if not next_token:
                break
        return out

    def _auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._bearer}"}

    @staticmethod
    def _format_start_time(dt: datetime) -> str:
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _extract_videos(payload: dict[str, Any], username: str) -> Iterator[FetchedVideo]:
    """Yield FetchedVideo for each tweet in the page that has a video media.

    Server-side `filter:native_video` should already restrict results to
    video tweets, but the type check is kept defensively.
    """
    tweets = payload.get("data") or []
    media_by_key: dict[str, dict[str, Any]] = {
        m["media_key"]: m for m in payload.get("includes", {}).get("media", [])
    }
    for tweet in tweets:
        media_keys = (tweet.get("attachments") or {}).get("media_keys") or []
        videos = [
            media_by_key[k]
            for k in media_keys
            if k in media_by_key and media_by_key[k].get("type") == "video"
        ]
        if not videos:
            continue
        first = videos[0]
        duration_ms = int(first.get("duration_ms") or 0)
        yield FetchedVideo(
            id=str(tweet["id"]),
            url=f"https://x.com/{username}/status/{tweet['id']}",
            posted_at=_parse_created_at(tweet["created_at"]),
            duration_sec=round(duration_ms / 1000),
            text=tweet.get("text", ""),
        )


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
