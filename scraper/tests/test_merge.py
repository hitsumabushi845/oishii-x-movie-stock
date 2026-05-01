from datetime import datetime, timezone
from scraper.merge import merge_videos, MergeResult
from scraper.models import Video


def _v(id_: str, posted: str, text: str = "x", duration: int = 60, tags=None) -> Video:
    return Video(
        id=id_,
        url=f"https://x.com/official_aimai/status/{id_}",
        posted_at=datetime.fromisoformat(posted.replace("Z", "+00:00")),
        duration_sec=duration,
        text=text,
        tags=tags or [],
    )


def test_merge_adds_new_videos():
    existing = [_v("1", "2026-04-01T00:00:00Z")]
    fetched = [_v("2", "2026-04-02T00:00:00Z")]
    r = merge_videos(existing, fetched)
    assert [v.id for v in r.videos] == ["2", "1"]
    assert r.added == 1
    assert r.updated == 0


def test_merge_updates_existing_text_but_preserves_tags():
    existing = [_v("1", "2026-04-01T00:00:00Z", text="old", tags=["live"])]
    fetched = [_v("1", "2026-04-01T00:00:00Z", text="new", tags=[])]
    r = merge_videos(existing, fetched)
    assert r.videos[0].text == "new"
    assert r.videos[0].tags == ["live"]
    assert r.added == 0
    assert r.updated == 1


def test_merge_does_not_drop_existing_when_fetch_is_subset():
    existing = [_v("1", "2026-04-01T00:00:00Z"), _v("2", "2026-04-02T00:00:00Z")]
    fetched = [_v("3", "2026-04-03T00:00:00Z")]
    r = merge_videos(existing, fetched)
    assert sorted(v.id for v in r.videos) == ["1", "2", "3"]
    assert [v.id for v in r.videos] == ["3", "2", "1"]


def test_merge_dedupes_within_fetched():
    existing = []
    fetched = [
        _v("1", "2026-04-01T00:00:00Z", text="a"),
        _v("1", "2026-04-01T00:00:00Z", text="b"),
    ]
    r = merge_videos(existing, fetched)
    assert len(r.videos) == 1


def test_merge_result_content_changed_false_when_identical():
    existing = [_v("1", "2026-04-01T00:00:00Z")]
    fetched = [_v("1", "2026-04-01T00:00:00Z")]
    r = merge_videos(existing, fetched)
    assert r.content_changed is False


def test_merge_result_content_changed_true_on_text_diff():
    existing = [_v("1", "2026-04-01T00:00:00Z", text="old")]
    fetched = [_v("1", "2026-04-01T00:00:00Z", text="new")]
    r = merge_videos(existing, fetched)
    assert r.content_changed is True


def test_max_posted_at_returns_latest():
    existing = [_v("1", "2026-04-01T00:00:00Z")]
    fetched = [_v("2", "2026-04-05T00:00:00Z")]
    r = merge_videos(existing, fetched)
    assert r.max_posted_at == datetime(2026, 4, 5, tzinfo=timezone.utc)


def test_max_posted_at_with_only_existing():
    existing = [_v("1", "2026-04-01T00:00:00Z")]
    r = merge_videos(existing, [])
    assert r.max_posted_at == datetime(2026, 4, 1, tzinfo=timezone.utc)


def test_max_posted_at_when_all_empty_is_none():
    r = merge_videos([], [])
    assert r.max_posted_at is None
