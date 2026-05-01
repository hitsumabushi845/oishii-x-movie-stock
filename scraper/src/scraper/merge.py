"""Merge newly fetched videos into the existing list."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from .models import Video


@dataclass
class MergeResult:
    videos: list[Video]
    added: int
    updated: int
    max_posted_at: datetime | None
    content_changed: bool


def merge_videos(existing: list[Video], fetched: list[Video]) -> MergeResult:
    by_id: dict[str, Video] = {v.id: v for v in existing}
    added = 0
    updated = 0
    seen_in_fetched: set[str] = set()

    for incoming in fetched:
        if incoming.id in seen_in_fetched:
            continue
        seen_in_fetched.add(incoming.id)
        if incoming.id in by_id:
            existing_v = by_id[incoming.id]
            merged = incoming.model_copy(update={"tags": existing_v.tags})
            if merged.model_dump() != existing_v.model_dump():
                updated += 1
            by_id[incoming.id] = merged
        else:
            by_id[incoming.id] = incoming
            added += 1

    merged_list = sorted(by_id.values(), key=lambda v: v.posted_at, reverse=True)
    max_posted = merged_list[0].posted_at if merged_list else None

    content_changed = added > 0 or updated > 0

    return MergeResult(
        videos=merged_list,
        added=added,
        updated=updated,
        max_posted_at=max_posted,
        content_changed=content_changed,
    )
