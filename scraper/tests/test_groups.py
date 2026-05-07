import json
from pathlib import Path

import pytest

from scraper.groups import (
    Group,
    GroupNotFoundError,
    GroupsManifest,
    ManifestError,
    build_query,
    load_manifest,
)


def _schema_path() -> Path:
    return Path(__file__).resolve().parents[2] / "schema" / "groups.schema.json"


def _write(tmp_path: Path, payload: dict) -> Path:
    p = tmp_path / "groups.json"
    p.write_text(json.dumps(payload), encoding="utf-8")
    return p


def _valid_payload() -> dict:
    return {
        "groups": [
            {
                "slug": "aimai",
                "display_name": "Aimai",
                "x_handle": "official_aimai",
                "data_file": "aimai.json",
                "color": "#bc2956",
            },
            {
                "slug": "shokuzai",
                "display_name": "Shokuzai",
                "x_handle": "ofc_shokuzai",
                "data_file": "shokuzai.json",
                "color": "#1A1A1A",
                "color_dark": "#f7f9f9",
            },
        ]
    }


def test_load_manifest_returns_groups(tmp_path):
    path = _write(tmp_path, _valid_payload())
    manifest = load_manifest(path, _schema_path())
    assert isinstance(manifest, GroupsManifest)
    slugs = [g.slug for g in manifest.groups]
    assert slugs == ["aimai", "shokuzai"]
    assert manifest.find("aimai").x_handle == "official_aimai"


def test_load_manifest_rejects_duplicate_slug(tmp_path):
    payload = _valid_payload()
    payload["groups"].append(dict(payload["groups"][0]))
    path = _write(tmp_path, payload)
    with pytest.raises(ManifestError) as exc:
        load_manifest(path, _schema_path())
    assert "duplicate" in str(exc.value).lower()


def test_load_manifest_rejects_missing_field(tmp_path):
    payload = _valid_payload()
    del payload["groups"][0]["color"]
    path = _write(tmp_path, payload)
    with pytest.raises(ManifestError):
        load_manifest(path, _schema_path())


def test_load_manifest_rejects_bad_handle(tmp_path):
    payload = _valid_payload()
    payload["groups"][0]["x_handle"] = "has spaces"
    path = _write(tmp_path, payload)
    with pytest.raises(ManifestError):
        load_manifest(path, _schema_path())


def test_find_unknown_slug_raises(tmp_path):
    path = _write(tmp_path, _valid_payload())
    manifest = load_manifest(path, _schema_path())
    with pytest.raises(GroupNotFoundError):
        manifest.find("ghost")


def test_build_query_uses_template():
    g = Group(
        slug="aimai",
        display_name="Aimai",
        x_handle="official_aimai",
        data_file="aimai.json",
        color="#bc2956",
    )
    assert build_query(g) == "from:official_aimai has:videos -is:retweet"
