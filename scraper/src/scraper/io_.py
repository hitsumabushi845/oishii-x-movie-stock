"""JSON I/O and schema validation for videos.json."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import jsonschema
from pydantic import ValidationError

from .models import VideosFile


class SchemaValidationError(Exception):
    """Raised when JSON payload does not match videos.schema.json."""


def load_videos_file(path: Path) -> VideosFile | None:
    """Read and parse videos.json. Return None if file does not exist."""
    if not path.exists():
        return None
    raw = json.loads(path.read_text(encoding="utf-8"))
    raw.pop("$schema", None)
    try:
        return VideosFile.model_validate(raw)
    except ValidationError as e:
        raise SchemaValidationError(str(e)) from e


def write_videos_file(
    path: Path,
    payload: VideosFile,
    *,
    schema_pointer: str | None = None,
) -> None:
    """Write videos.json with stable formatting."""
    data: dict[str, Any] = {}
    if schema_pointer:
        data["$schema"] = schema_pointer
    data.update(json.loads(payload.model_dump_json()))
    text = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=False)
    text = _normalize_iso_z(text)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text + "\n", encoding="utf-8")


def validate_against_schema(payload: dict[str, Any], schema_path: Path) -> None:
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    payload_to_check = {k: v for k, v in payload.items() if k != "$schema"}
    try:
        jsonschema.validate(payload_to_check, schema)
    except jsonschema.ValidationError as e:
        raise SchemaValidationError(e.message) from e


def _normalize_iso_z(text: str) -> str:
    """Pydantic emits +00:00 for UTC; we want trailing Z to match the schema."""
    return text.replace("+00:00", "Z")


def utc_now() -> datetime:
    return datetime.now(tz=timezone.utc).replace(microsecond=0)
