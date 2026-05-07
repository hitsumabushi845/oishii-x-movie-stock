"""Manifest of OISHII groups (slug -> X handle / data file / theme color)."""

from __future__ import annotations

import json
from pathlib import Path

import jsonschema
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator


class ManifestError(Exception):
    """Raised when groups.json is missing, malformed, or schema-invalid."""


class GroupNotFoundError(ManifestError):
    """Raised when a slug does not exist in the manifest."""


class Group(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: str = Field(pattern=r"^[a-z][a-z0-9_-]*$")
    display_name: str = Field(min_length=1)
    x_handle: str = Field(pattern=r"^[A-Za-z0-9_]{1,15}$")
    data_file: str = Field(pattern=r"^[A-Za-z0-9_.-]+\.json$")
    color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    color_dark: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")


class GroupsManifest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    groups: list[Group]

    @field_validator("groups")
    @classmethod
    def _no_duplicate_slugs(cls, value: list[Group]) -> list[Group]:
        seen: set[str] = set()
        for g in value:
            if g.slug in seen:
                raise ValueError(f"duplicate slug in manifest: {g.slug}")
            seen.add(g.slug)
        return value

    def find(self, slug: str) -> Group:
        for g in self.groups:
            if g.slug == slug:
                return g
        raise GroupNotFoundError(f"unknown group slug: {slug}")


def load_manifest(manifest_path: Path, schema_path: Path) -> GroupsManifest:
    """Read and validate groups.json against the JSON Schema and pydantic model."""
    if not manifest_path.exists():
        raise ManifestError(f"manifest not found: {manifest_path}")
    raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    raw.pop("$schema", None)

    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    try:
        jsonschema.validate(raw, schema)
    except jsonschema.ValidationError as e:
        raise ManifestError(f"schema validation failed: {e.message}") from e

    try:
        return GroupsManifest.model_validate(raw)
    except ValidationError as e:
        raise ManifestError(str(e)) from e


def build_query(group: Group) -> str:
    """Build the X API query string for a group."""
    return f"from:{group.x_handle} has:videos -is:retweet"
