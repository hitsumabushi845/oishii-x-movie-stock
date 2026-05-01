"""X API v2 backed implementation of Source."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterator

import httpx

from .base import FetchedVideo

USER_LOOKUP_URL = "https://api.twitter.com/2/users/by/username/{username}"
USER_TWEETS_URL = "https://api.twitter.com/2/users/{user_id}/tweets"
DEFAULT_USERNAME = "official_aimai"


class XApiSource:
    """Fetch native videos from a single user's timeline via X API v2."""

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
        self._user_id: str | None = None

    async def fetch(
        self, query: str, *, since: datetime | None = None
    ) -> list[FetchedVideo]:
        # `query` is ignored for parity with the Source protocol; we always
        # fetch the configured user's timeline.
        del query
        async with self._maybe_owned_client() as client:
            user_id = await self._get_user_id(client)
            return await self._fetch_user_videos(client, user_id, since)

    def _maybe_owned_client(self) -> "_ClientCtx":
        if self._client is not None:
            return _ClientCtx.shared(self._client)
        owned = httpx.AsyncClient(
            headers={"Authorization": f"Bearer {self._bearer}"},
            timeout=30.0,
        )
        return _ClientCtx.owned(owned)

    async def _get_user_id(self, client: httpx.AsyncClient) -> str:
        if self._user_id:
            return self._user_id
        url = USER_LOOKUP_URL.format(username=self._username)
        r = await client.get(url, headers=self._auth_headers())
        r.raise_for_status()
        self._user_id = r.json()["data"]["id"]
        return self._user_id

    async def _fetch_user_videos(
        self,
        client: httpx.AsyncClient,
        user_id: str,
        since: datetime | None,
    ) -> list[FetchedVideo]:
        url = USER_TWEETS_URL.format(user_id=user_id)
        params: dict[str, Any] = {
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
            r = await client.get(url, params=page_params, headers=self._auth_headers())
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
        # X API expects RFC 3339 (YYYY-MM-DDTHH:MM:SSZ).
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _extract_videos(payload: dict[str, Any], username: str) -> Iterator[FetchedVideo]:
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
    # X API created_at is ISO 8601 with Z suffix and may include milliseconds.
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
