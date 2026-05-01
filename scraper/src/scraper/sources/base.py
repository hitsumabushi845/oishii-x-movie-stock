"""Abstract Source protocol so the scraping backend is swappable."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass
class FetchedVideo:
    id: str
    url: str
    posted_at: datetime
    duration_sec: int
    text: str


class Source(Protocol):
    """Anything that returns videos for a given X search query."""

    async def fetch(
        self, query: str, *, since: datetime | None = None
    ) -> list[FetchedVideo]:
        ...
