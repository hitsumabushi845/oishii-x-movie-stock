# Multi-Group Tabs Implementation Plan (OISHII Movie Stock)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scale the single-account site (`@official_aimai`) to support OISHII.inc's three groups (aimai / shokuzai / mizutama) with tabbed switching, per-group theme color, manifest-driven configuration, a matrix scraper workflow, and a site-wide rebrand to "OISHII Movie Stock".

**Architecture:** Introduce `data/groups.json` as a single source of truth listing each group (slug / display_name / x_handle / data_file / color). Each group's videos live in `data/<slug>.json` reusing the existing `VideosFile` schema. The scraper gains `--group` / `--all` / `--manifest` flags that resolve from the manifest. The frontend lazy-fetches the active group's data file, applies a per-group accent color via a `--group-accent` CSS custom property driven by `data-group` on `<html>`, and syncs the active tab to `?g=<slug>` (default omitted). The GitHub Actions workflow runs the scraper as a matrix per group and aggregates results into a single weekly PR.

**Tech Stack:** Python 3.12 + uv + pydantic + jsonschema (scraper), Vite + TypeScript + Fuse.js + happy-dom + vitest (web), GitHub Actions matrix + peter-evans/create-pull-request, JSON Schema 2020-12.

**Spec:** `docs/superpowers/specs/2026-05-06-multi-group-tabs-design.md`

**Branch:** `feat/multi-group-tabs` (already created with the spec committed).

## Progress (as of 2026-05-08)

Implementation is being executed via `superpowers:subagent-driven-development` (continuous, no human checkpoints between tasks). Each task gets: implementer subagent → spec compliance reviewer → code quality reviewer → mark complete.

| Plan Task | Status | Commit |
| --- | --- | --- |
| 1. Manifest JSON schema (`schema/groups.schema.json`) | ✅ done | `241661f` |
| 2. Manifest data file (`data/groups.json`) | ✅ done | `4c2b559` |
| 3. Rename `data/videos.json` → `data/aimai.json` (+vite/CI/deploy refs) | ✅ done | `fb01747` (amended to also cover `web/vite.config.ts`) |
| 4. Scraper manifest loader (`scraper/src/scraper/groups.py` + tests) | ✅ done | `d2b1ebb` |
| 5. Scraper CLI `--group/--all/--manifest` (+tests) | ✅ done | `81e6466` |
| 6. Web types `GroupDef` / `GroupsManifest` | ✅ done | `b2f518b` |
| 7. Web manifest parser (`parseGroupsManifest`, `loadGroupsManifest`) | ✅ done | `4dd8a72` |
| 8. Stub data files for shokuzai / mizutama (epoch `last_synced_at`) | ✅ done | `f95e52e` |
| 9. HTML rebrand to OISHII Movie Stock + empty `<nav id="tabs">` | ✅ done | `39d1ddc` |
| 10. CSS `--group-accent` variable + `.tabs` styles (incl. mobile) | ✅ done | `5b160fd` |
| 11. `web/src/groups.ts` (theme + tabs DOM, TDD) | ✅ done | `f870497` |
| 12. Wire tabs into `web/src/main.ts` (state / lazy load / cache / popstate / URL) | ✅ done | `d248f88` (race-guard added in amend after code review) |
| 13. Update `web/tests/index-html.test.ts` for new branding + tabs nav | ✅ done | `61119d1` |
| 14. `update-data.yml` matrix scrape + aggregate PR | ✅ done | `db48627` (Slack-on-failure conditional widened in amend after code review) |
| 15. README updates (multi-group install + group-add section) | ✅ done | `75e1fee` |
| 16. **User actions** — local backfill of shokuzai/mizutama, place `web/public/oishii_movie_stock.png`, push branch, open PR | ⏳ pending | — (operational, not auto-runnable) |
| (Final) End-to-end code review of full implementation | ✅ done | (see "Final review punch list" below) |

### Final review punch list (Minor — non-blocking, follow-up candidates)

The whole-branch review verdict was **✅ Ready to merge after Task 16** with no Critical or Important issues. Minor items found that the per-task reviews did not catch (because each was scoped to a single task):

- **Spec gap: keyboard arrow nav between tabs.** Spec line 298 requires "矢印キーでタブ間移動を可能にする". `web/src/groups.ts:48-67` sets `tabindex` and `aria-selected` correctly but never registers a `keydown` handler — ArrowLeft / ArrowRight don't move focus. ARIA ergonomics gap, not a functional break. Plan Task 11's `buildTabs` code block omitted this, so the implementer faithfully copied a plan that didn't match the spec.
- **`scraper/README.md` is stale.** Still documents only `--data-file ../data/videos.json` and doesn't mention `--group`/`--all`/`--manifest`. Top-level README was rewritten by Task 15; this sub-README was missed.
- **`Makefile`'s `scrape-dry` target is broken.** Invokes legacy `--data-file ../data/videos.json` which no longer exists — `make scrape-dry` will fail or write a stray file. Switch to manifest mode (e.g. `--all --manifest ../data/groups.json --manifest-schema ../schema/groups.schema.json --schema ../schema/videos.schema.json --data-dir ../data --dry-run`).
- **Failed-fetch caching footgun.** `groupCache` (`web/src/main.ts:71`) stores rejected Promises permanently — a transient 5xx on first tab visit means subsequent clicks rethrow forever until reload. A `.catch(() => groupCache.delete(slug))` would self-heal.
- **`web/index.html:31`** still hardcodes `href="https://x.com/official_aimai"` as the static fallback. `updateHeaderForGroup` overrides on bootstrap so JS users don't see it; non-JS users do.

### How to resume in a future session

1. The implementation is complete through Task 15. Outstanding work is Task 16 (operational, user-driven) plus the optional follow-up punch list above.
2. Task 16 lives at the bottom of this plan and runs the local backfill, places the OGP image, and pushes/opens the PR.

**File structure (added / changed):**

| Path | Responsibility |
| ---- | -------------- |
| `schema/groups.schema.json` | JSON Schema for the groups manifest |
| `data/groups.json` | Manifest listing the 3 OISHII groups |
| `data/aimai.json` | (Renamed from `data/videos.json`) |
| `data/shokuzai.json` | Stub then backfilled per-group data |
| `data/mizutama.json` | Stub then backfilled per-group data |
| `scraper/src/scraper/groups.py` | Manifest loader + slug resolver |
| `scraper/src/scraper/cli.py` | `--group` / `--all` / `--manifest` plumbing |
| `scraper/tests/test_groups.py` | Manifest loader unit tests |
| `scraper/tests/test_cli.py` | New CLI flag tests |
| `web/src/types.ts` | `GroupDef` / `GroupsManifest` types |
| `web/src/data.ts` | Manifest loader, `parseGroupsManifest` |
| `web/src/groups.ts` | Tab DOM building, theme application, slug resolution |
| `web/src/main.ts` | State w/ `activeGroup`, lazy load + cache, popstate, tab events |
| `web/src/styles.css` | `--group-accent`, `.tabs` styles |
| `web/index.html` | New title/OGP, empty `<nav id="tabs">` placeholder |
| `web/tests/groups.test.ts` | Manifest parsing + theme + tabs tests |
| `web/tests/data.test.ts` | Manifest parser tests added |
| `web/tests/index-html.test.ts` | Updated for new title/OGP + tabs nav |
| `.github/workflows/update-data.yml` | Matrix scrape + aggregate PR |
| `.github/workflows/ci.yml` | Schema-validate iterates per-group + manifest |
| `.github/workflows/deploy.yml` | Path filter follows new data layout |
| `web/public/oishii_movie_stock.png` | **User-provided asset** (not produced by this plan) |
| `README.md` | Updated install / backfill / group-add instructions |

---

## Task 1: Add the manifest JSON schema

**Files:**
- Create: `schema/groups.schema.json`

- [ ] **Step 1: Write the schema file**

Write the exact content below to `schema/groups.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/hitsumabushi845/aimai-x-movie-stock/schema/groups.schema.json",
  "title": "GroupsManifest",
  "type": "object",
  "required": ["groups"],
  "additionalProperties": false,
  "properties": {
    "$schema": { "type": "string" },
    "groups": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/group" }
    }
  },
  "$defs": {
    "group": {
      "type": "object",
      "required": ["slug", "display_name", "x_handle", "data_file", "color"],
      "additionalProperties": false,
      "properties": {
        "slug":         { "type": "string", "pattern": "^[a-z][a-z0-9_-]*$" },
        "display_name": { "type": "string", "minLength": 1 },
        "x_handle":     { "type": "string", "pattern": "^[A-Za-z0-9_]{1,15}$" },
        "data_file":    { "type": "string", "pattern": "^[A-Za-z0-9_.-]+\\.json$" },
        "color":        { "type": "string", "pattern": "^#[0-9A-Fa-f]{6}$" },
        "color_dark":   { "type": "string", "pattern": "^#[0-9A-Fa-f]{6}$" }
      }
    }
  }
}
```

- [ ] **Step 2: Verify schema parses**

Run:
```bash
python -c "import json; json.load(open('schema/groups.schema.json'))"
```
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add schema/groups.schema.json
git commit -m "feat(schema): add groups manifest schema"
```

---

## Task 2: Add the manifest data file

**Files:**
- Create: `data/groups.json`

- [ ] **Step 1: Write the manifest**

Write the exact content below to `data/groups.json`:

```json
{
  "$schema": "../schema/groups.schema.json",
  "groups": [
    {
      "slug": "aimai",
      "display_name": "美味しい曖昧",
      "x_handle": "official_aimai",
      "data_file": "aimai.json",
      "color": "#bc2956"
    },
    {
      "slug": "shokuzai",
      "display_name": "美味しい贖罪",
      "x_handle": "ofc_shokuzai",
      "data_file": "shokuzai.json",
      "color": "#1A1A1A",
      "color_dark": "#f7f9f9"
    },
    {
      "slug": "mizutama",
      "display_name": "美味しい水玉",
      "x_handle": "oishii_mizutama",
      "data_file": "mizutama.json",
      "color": "#6CAAEF"
    }
  ]
}
```

- [ ] **Step 2: Validate manifest against schema**

Run:
```bash
python - <<'PY'
import json
import jsonschema
payload = json.load(open("data/groups.json", encoding="utf-8"))
payload.pop("$schema", None)
schema = json.load(open("schema/groups.schema.json", encoding="utf-8"))
jsonschema.validate(payload, schema)
print("ok")
PY
```
Expected: `ok` printed, exit 0.

- [ ] **Step 3: Commit**

```bash
git add data/groups.json
git commit -m "feat(data): add groups manifest with 3 OISHII groups"
```

---

## Task 3: Rename `data/videos.json` → `data/aimai.json` and update direct references

**Files:**
- Rename: `data/videos.json` → `data/aimai.json`
- Modify: `web/src/main.ts:10` (DATA_URL constant)
- Modify: `.github/workflows/deploy.yml:8` (path filter)
- Modify: `.github/workflows/ci.yml:46-65` (schema-validate step)

This task keeps the site fully functional with a single group; multi-group features come in later tasks.

- [ ] **Step 1: Rename the data file (preserves history)**

```bash
git mv data/videos.json data/aimai.json
```

- [ ] **Step 2: Update DATA_URL in `web/src/main.ts`**

In `web/src/main.ts`, change the line:
```ts
const DATA_URL = "./data/videos.json";
```
to:
```ts
const DATA_URL = "./data/aimai.json";
```

- [ ] **Step 3: Update path filter in `deploy.yml`**

In `.github/workflows/deploy.yml`, change the `paths:` block (around line 6–9):
```yaml
    paths:
      - "web/**"
      - "data/videos.json"
      - ".github/workflows/deploy.yml"
```
to:
```yaml
    paths:
      - "web/**"
      - "data/*.json"
      - "schema/*.json"
      - ".github/workflows/deploy.yml"
```

- [ ] **Step 4: Update `ci.yml` schema-validate to iterate per-group files and the manifest**

Replace the `schema-validate` job in `.github/workflows/ci.yml` (lines 46-65) with:

```yaml
  schema-validate:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
      - uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065 # v5.6.0
        with:
          python-version: "3.12"
      - run: pip install jsonschema==4.22.0
      - name: Validate
        run: |
          python - <<'PY'
          import json
          import pathlib
          import jsonschema

          data_dir = pathlib.Path("data")
          videos_schema = json.load(open("schema/videos.schema.json", encoding="utf-8"))
          groups_schema = json.load(open("schema/groups.schema.json", encoding="utf-8"))

          manifest = json.load(open(data_dir / "groups.json", encoding="utf-8"))
          manifest_check = {k: v for k, v in manifest.items() if k != "$schema"}
          jsonschema.validate(manifest_check, groups_schema)

          for group in manifest["groups"]:
              path = data_dir / group["data_file"]
              if not path.exists():
                  raise SystemExit(f"missing data file: {path}")
              payload = json.load(open(path, encoding="utf-8"))
              payload.pop("$schema", None)
              jsonschema.validate(payload, videos_schema)
          print("ok")
          PY
```

- [ ] **Step 5: Verify web tests still pass with the renamed file**

Run:
```bash
cd web && pnpm install --frozen-lockfile && pnpm test
```
Expected: all tests pass (the index-html test will still pass; main.ts is not under direct unit test).

- [ ] **Step 6: Verify the dev server still loads the data**

Run:
```bash
cd web && pnpm dev
```
Open `http://localhost:5173` in a browser, confirm the list renders. Stop the dev server (`Ctrl-C`).

- [ ] **Step 7: Commit**

```bash
git add data/aimai.json web/src/main.ts .github/workflows/deploy.yml .github/workflows/ci.yml
git commit -m "refactor: rename data/videos.json to data/aimai.json and broaden CI path filters"
```

---

## Task 4: Add scraper manifest loader (`scraper/src/scraper/groups.py`)

**Files:**
- Create: `scraper/src/scraper/groups.py`
- Create: `scraper/tests/test_groups.py`

- [ ] **Step 1: Write the failing tests**

Create `scraper/tests/test_groups.py` with the following content:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd scraper && uv run pytest tests/test_groups.py -v
```
Expected: import error or `ModuleNotFoundError` for `scraper.groups`.

- [ ] **Step 3: Implement `scraper/src/scraper/groups.py`**

Create `scraper/src/scraper/groups.py` with the following content:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd scraper && uv run pytest tests/test_groups.py -v
```
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scraper/src/scraper/groups.py scraper/tests/test_groups.py
git commit -m "feat(scraper): add groups manifest loader"
```

---

## Task 5: Add `--group` / `--all` / `--manifest` flags to scraper CLI

**Files:**
- Modify: `scraper/src/scraper/cli.py`
- Modify: `scraper/tests/test_cli.py`

- [ ] **Step 1: Write the failing tests**

Append the following to `scraper/tests/test_cli.py`:

```python
import io
import json as _json
from contextlib import redirect_stderr

from scraper.cli import main as cli_main


def _write_groups_manifest(tmp_path: Path) -> Path:
    payload = {
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
            },
        ]
    }
    p = tmp_path / "groups.json"
    p.write_text(_json.dumps(payload), encoding="utf-8")
    return p


def _groups_schema_path() -> Path:
    return Path(__file__).resolve().parents[2] / "schema" / "groups.schema.json"


@pytest.mark.asyncio
async def test_run_with_group_resolves_handle_into_query(tmp_path, monkeypatch):
    """When invoked with --group, the CLI must resolve the manifest into the
    correct query string and write to data/<slug>.json."""
    from scraper import cli as cli_module

    captured: dict[str, object] = {}

    class CapturingSource:
        async def fetch(self, query, *, since=None):
            captured["query"] = query
            captured["since"] = since
            return [
                FetchedVideo(
                    "1", "u1",
                    datetime(2026, 4, 1, tzinfo=timezone.utc), 60, "x",
                ),
            ]

    def fake_factory(_token: str) -> CapturingSource:
        return CapturingSource()

    monkeypatch.setattr(cli_module, "_default_source_factory", fake_factory)
    monkeypatch.setenv("X_BEARER_TOKEN", "dummy")

    manifest = _write_groups_manifest(tmp_path)
    data_dir = tmp_path
    code = cli_main([
        "--group", "shokuzai",
        "--manifest", str(manifest),
        "--data-dir", str(data_dir),
        "--manifest-schema", str(_groups_schema_path()),
        "--schema", str(_schema_path()),
        "--backfill",
    ])
    assert code == 0
    assert captured["query"] == "from:ofc_shokuzai has:videos -is:retweet"
    assert (data_dir / "shokuzai.json").exists()


@pytest.mark.asyncio
async def test_run_with_group_and_legacy_query_is_rejected(tmp_path, monkeypatch):
    monkeypatch.setenv("X_BEARER_TOKEN", "dummy")
    manifest = _write_groups_manifest(tmp_path)
    err = io.StringIO()
    with redirect_stderr(err):
        code = cli_main([
            "--group", "aimai",
            "--manifest", str(manifest),
            "--manifest-schema", str(_groups_schema_path()),
            "--data-dir", str(tmp_path),
            "--schema", str(_schema_path()),
            "--query", "extra-query",
        ])
    assert code == 3
    assert "--query" in err.getvalue() or "incompatible" in err.getvalue().lower()


@pytest.mark.asyncio
async def test_run_with_all_iterates_all_groups(tmp_path, monkeypatch):
    from scraper import cli as cli_module

    seen: list[str] = []

    class TrackingSource:
        async def fetch(self, query, *, since=None):
            seen.append(query)
            return [
                FetchedVideo(
                    "1", "u1",
                    datetime(2026, 4, 1, tzinfo=timezone.utc), 60, "x",
                ),
            ]

    monkeypatch.setattr(cli_module, "_default_source_factory", lambda _t: TrackingSource())
    monkeypatch.setenv("X_BEARER_TOKEN", "dummy")
    manifest = _write_groups_manifest(tmp_path)
    code = cli_main([
        "--all",
        "--manifest", str(manifest),
        "--manifest-schema", str(_groups_schema_path()),
        "--data-dir", str(tmp_path),
        "--schema", str(_schema_path()),
        "--backfill",
    ])
    assert code == 0
    assert seen == [
        "from:official_aimai has:videos -is:retweet",
        "from:ofc_shokuzai has:videos -is:retweet",
    ]
    assert (tmp_path / "aimai.json").exists()
    assert (tmp_path / "shokuzai.json").exists()


@pytest.mark.asyncio
async def test_run_with_all_continues_after_one_group_fails(tmp_path, monkeypatch):
    from scraper import cli as cli_module

    calls: list[str] = []

    class FlakySource:
        async def fetch(self, query, *, since=None):
            calls.append(query)
            if "official_aimai" in query:
                raise RuntimeError("boom")
            return [
                FetchedVideo(
                    "1", "u1",
                    datetime(2026, 4, 1, tzinfo=timezone.utc), 60, "x",
                ),
            ]

    monkeypatch.setattr(cli_module, "_default_source_factory", lambda _t: FlakySource())
    monkeypatch.setenv("X_BEARER_TOKEN", "dummy")
    manifest = _write_groups_manifest(tmp_path)
    code = cli_main([
        "--all",
        "--manifest", str(manifest),
        "--manifest-schema", str(_groups_schema_path()),
        "--data-dir", str(tmp_path),
        "--schema", str(_schema_path()),
        "--backfill",
    ])
    # 1 group failed → exit 2 (non-zero)
    assert code == 2
    assert len(calls) == 2
    # Successful group's file is written even though a sibling failed
    assert (tmp_path / "shokuzai.json").exists()
    assert not (tmp_path / "aimai.json").exists()
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd scraper && uv run pytest tests/test_cli.py -v
```
Expected: errors about missing CLI flags `--group`, `--all`, `--manifest`, `--manifest-schema`, `--data-dir`, and missing attribute `_default_source_factory`.

- [ ] **Step 3: Implement the CLI changes in `scraper/src/scraper/cli.py`**

Replace the entire contents of `scraper/src/scraper/cli.py` with:

```python
"""CLI orchestration: read existing → fetch → merge → validate → write."""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from .groups import (
    Group,
    GroupsManifest,
    ManifestError,
    build_query,
    load_manifest,
)
from .io_ import (
    SchemaValidationError,
    load_videos_file,
    utc_now,
    validate_against_schema,
    write_videos_file,
)
from .merge import merge_videos
from .models import Video, VideosFile
from .sources import FetchedVideo, Source

DEFAULT_QUERY = "from:official_aimai has:videos -is:retweet"
SCHEMA_POINTER = "../schema/videos.schema.json"

# search/all defaults to roughly the last 30 days when start_time is unset.
# For backfill we want the full archive, so we send an explicit early date.
BACKFILL_EPOCH = datetime(2010, 1, 1, tzinfo=timezone.utc)


def _default_source_factory(bearer: str) -> Source:
    from .sources.x_api_source import XApiSource

    return XApiSource(bearer_token=bearer)


async def run(
    *,
    source: Source,
    query: str,
    data_file: Path,
    schema_file: Path,
    backfill: bool,
    require_existing: bool,
    dry_run: bool,
    summary_out: Path | None = None,
    summary_label: str | None = None,
) -> int:
    existing_file = load_videos_file(data_file)

    if require_existing and (existing_file is None or existing_file.last_synced_at is None):
        print(
            "error: --require-existing was set but no existing videos.json was found",
            file=sys.stderr,
        )
        return 5

    if backfill:
        since = BACKFILL_EPOCH
    elif existing_file is None:
        since = None
    else:
        since = existing_file.last_synced_at

    try:
        fetched = await source.fetch(query, since=since)
    except Exception as e:  # noqa: BLE001
        print(f"error: source fetch failed: {e}", file=sys.stderr)
        return 2

    fetched_videos = [_to_video(v) for v in fetched]
    existing_videos = existing_file.videos if existing_file else []
    result = merge_videos(existing_videos, fetched_videos)

    if not result.content_changed and existing_file is not None:
        _emit_summary(
            summary_out, fetched_count=len(fetched), added=0, updated=0,
            changed=False, label=summary_label,
        )
        return 0

    new_max = result.max_posted_at or (
        existing_file.last_synced_at if existing_file else utc_now()
    )
    new_file = VideosFile(
        generated_at=utc_now(),
        last_synced_at=new_max,
        source_query=query,
        videos=result.videos,
    )

    payload_dict = _to_payload(new_file)
    try:
        validate_against_schema(payload_dict, schema_file)
    except SchemaValidationError as e:
        print(f"error: schema validation failed: {e}", file=sys.stderr)
        return 4

    if dry_run:
        print(
            f"[dry-run] would write {len(new_file.videos)} videos "
            f"(added={result.added}, updated={result.updated})"
        )
        _emit_summary(
            summary_out, fetched_count=len(fetched),
            added=result.added, updated=result.updated, changed=True,
            label=summary_label,
        )
        return 0

    write_videos_file(data_file, new_file, schema_pointer=SCHEMA_POINTER)
    _emit_summary(
        summary_out, fetched_count=len(fetched),
        added=result.added, updated=result.updated, changed=True,
        label=summary_label,
    )
    return 0


def _to_video(v: FetchedVideo) -> Video:
    return Video(
        id=v.id, url=v.url, posted_at=v.posted_at,
        duration_sec=v.duration_sec, text=v.text, tags=[],
    )


def _to_payload(f: VideosFile) -> dict:
    import json
    return json.loads(f.model_dump_json())


def _emit_summary(
    out: Path | None,
    *,
    fetched_count: int,
    added: int,
    updated: int,
    changed: bool,
    label: str | None = None,
) -> None:
    line = (
        f"fetched={fetched_count} added={added} updated={updated} "
        f"changed={'yes' if changed else 'no'}"
    )
    print(f"[{label}] {line}" if label else line)
    if out is not None:
        with out.open("a", encoding="utf-8") as fp:
            heading = f"### scraper summary [{label}]" if label else "### scraper summary"
            fp.write(f"{heading}\n\n- {line}\n")


async def _run_for_group(
    *,
    group: Group,
    manifest_dir: Path,
    data_dir: Path,
    schema_file: Path,
    backfill: bool,
    require_existing: bool,
    dry_run: bool,
    summary_out: Path | None,
    source: Source,
) -> int:
    data_file = (data_dir / group.data_file).resolve() if data_dir else (
        manifest_dir / group.data_file
    ).resolve()
    return await run(
        source=source,
        query=build_query(group),
        data_file=data_file,
        schema_file=schema_file,
        backfill=backfill,
        require_existing=require_existing,
        dry_run=dry_run,
        summary_out=summary_out,
        summary_label=group.slug,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="scraper")

    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--group", help="manifest slug to scrape")
    mode.add_argument("--all", action="store_true", help="scrape every group in manifest")

    parser.add_argument("--manifest", type=Path, default=None,
                        help="path to data/groups.json (required with --group/--all)")
    parser.add_argument("--manifest-schema", type=Path, default=None,
                        help="path to schema/groups.schema.json (defaults to sibling of --manifest)")
    parser.add_argument("--data-dir", type=Path, default=None,
                        help="directory holding per-group data files (defaults to manifest directory)")

    parser.add_argument("--data-file", type=Path, default=None,
                        help="legacy: per-group data file (used only with --query)")
    parser.add_argument("--query", default=None, help="legacy: explicit query string")

    parser.add_argument("--schema", dest="schema_file", required=True, type=Path,
                        help="schema/videos.schema.json")
    parser.add_argument("--backfill", action="store_true")
    parser.add_argument("--require-existing", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--summary-out", type=Path, default=None)
    args = parser.parse_args(argv)

    using_manifest = args.group is not None or args.all
    using_legacy = args.query is not None or args.data_file is not None

    if using_manifest and using_legacy:
        print(
            "error: --group/--all are incompatible with legacy --query/--data-file",
            file=sys.stderr,
        )
        return 3
    if not using_manifest and not using_legacy:
        print(
            "error: must specify either --group/--all (with --manifest) or --query+--data-file",
            file=sys.stderr,
        )
        return 3
    if using_manifest and args.manifest is None:
        print("error: --manifest is required with --group/--all", file=sys.stderr)
        return 3
    if using_legacy and (args.query is None or args.data_file is None):
        print(
            "error: legacy mode requires both --query and --data-file",
            file=sys.stderr,
        )
        return 3

    bearer = os.environ.get("X_BEARER_TOKEN")
    if not bearer:
        print("error: X_BEARER_TOKEN environment variable is required", file=sys.stderr)
        return 1
    source = _default_source_factory(bearer)

    try:
        if using_legacy:
            return asyncio.run(
                run(
                    source=source,
                    query=args.query,
                    data_file=args.data_file,
                    schema_file=args.schema_file,
                    backfill=args.backfill,
                    require_existing=args.require_existing,
                    dry_run=args.dry_run,
                    summary_out=args.summary_out,
                )
            )

        manifest_schema = args.manifest_schema or (
            args.manifest.parent.parent / "schema" / "groups.schema.json"
        )
        try:
            manifest: GroupsManifest = load_manifest(args.manifest, manifest_schema)
        except ManifestError as e:
            print(f"error: manifest invalid: {e}", file=sys.stderr)
            return 3

        manifest_dir = args.manifest.parent
        data_dir = args.data_dir or manifest_dir

        if args.group is not None:
            group = manifest.find(args.group)
            return asyncio.run(
                _run_for_group(
                    group=group,
                    manifest_dir=manifest_dir,
                    data_dir=data_dir,
                    schema_file=args.schema_file,
                    backfill=args.backfill,
                    require_existing=args.require_existing,
                    dry_run=args.dry_run,
                    summary_out=args.summary_out,
                    source=source,
                )
            )

        # --all: run each group; aggregate exit codes
        async def run_all() -> int:
            failures = 0
            for g in manifest.groups:
                rc = await _run_for_group(
                    group=g,
                    manifest_dir=manifest_dir,
                    data_dir=data_dir,
                    schema_file=args.schema_file,
                    backfill=args.backfill,
                    require_existing=args.require_existing,
                    dry_run=args.dry_run,
                    summary_out=args.summary_out,
                    source=source,
                )
                if rc != 0:
                    failures += 1
            return 0 if failures == 0 else 2

        return asyncio.run(run_all())
    except KeyboardInterrupt:
        return 1
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd scraper && uv run pytest tests/test_cli.py tests/test_groups.py -v
```
Expected: all tests pass (existing 4 + new 4 + previous test_groups.py 6).

- [ ] **Step 5: Commit**

```bash
git add scraper/src/scraper/cli.py scraper/tests/test_cli.py
git commit -m "feat(scraper): support --group / --all / --manifest CLI flags"
```

---

## Task 6: Add `GroupDef` and `GroupsManifest` types to web

**Files:**
- Modify: `web/src/types.ts`

- [ ] **Step 1: Append types to `web/src/types.ts`**

Replace the entire content of `web/src/types.ts` with:

```ts
export type Video = {
  id: string;
  url: string;
  posted_at: string;
  duration_sec: number;
  text: string;
  tags: string[];
};

export type VideosFile = {
  generated_at: string;
  last_synced_at: string;
  source_query: string;
  videos: Video[];
};

export type SortOrder = "asc" | "desc";

export type GroupDef = {
  slug: string;
  displayName: string;
  xHandle: string;
  dataFile: string;
  color: string;
  colorDark?: string;
};

export type GroupsManifest = {
  groups: GroupDef[];
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd web && pnpm exec tsc --noEmit
```
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add web/src/types.ts
git commit -m "feat(web): add GroupDef and GroupsManifest types"
```

---

## Task 7: Add manifest parser to `web/src/data.ts`

**Files:**
- Modify: `web/src/data.ts`
- Modify: `web/tests/data.test.ts`

- [ ] **Step 1: Write the failing tests**

Append the following to `web/tests/data.test.ts`:

```ts
import { parseGroupsManifest } from "../src/data.js";

describe("parseGroupsManifest", () => {
  const valid = {
    groups: [
      {
        slug: "aimai",
        display_name: "Aimai",
        x_handle: "official_aimai",
        data_file: "aimai.json",
        color: "#bc2956",
      },
      {
        slug: "shokuzai",
        display_name: "Shokuzai",
        x_handle: "ofc_shokuzai",
        data_file: "shokuzai.json",
        color: "#1A1A1A",
        color_dark: "#f7f9f9",
      },
    ],
  };

  it("converts snake_case to camelCase", () => {
    const m = parseGroupsManifest(valid);
    expect(m.groups[0].slug).toBe("aimai");
    expect(m.groups[0].displayName).toBe("Aimai");
    expect(m.groups[0].xHandle).toBe("official_aimai");
    expect(m.groups[0].dataFile).toBe("aimai.json");
    expect(m.groups[0].color).toBe("#bc2956");
    expect(m.groups[0].colorDark).toBeUndefined();
    expect(m.groups[1].colorDark).toBe("#f7f9f9");
  });

  it("rejects payloads with no groups", () => {
    expect(() => parseGroupsManifest({ groups: [] })).toThrow(/at least one group/);
  });

  it("rejects payloads with duplicate slugs", () => {
    const dup = { groups: [valid.groups[0], valid.groups[0]] };
    expect(() => parseGroupsManifest(dup)).toThrow(/duplicate/i);
  });

  it("rejects missing required fields", () => {
    const bad = { groups: [{ ...valid.groups[0], color: undefined }] };
    expect(() => parseGroupsManifest(bad)).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd web && pnpm test --run tests/data.test.ts
```
Expected: import error, `parseGroupsManifest is not exported`.

- [ ] **Step 3: Add parser to `web/src/data.ts`**

Append the following to `web/src/data.ts`:

```ts
import type { GroupDef, GroupsManifest } from "./types.js";

export async function loadGroupsManifest(url: string): Promise<GroupsManifest> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to fetch ${url}: ${res.status}`);
  return parseGroupsManifest(await res.json());
}

export function parseGroupsManifest(raw: unknown): GroupsManifest {
  if (!raw || typeof raw !== "object") throw new Error("invalid manifest payload");
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.groups)) throw new Error("groups must be array");
  if (r.groups.length === 0) throw new Error("manifest must contain at least one group");
  const seen = new Set<string>();
  const groups: GroupDef[] = r.groups.map((g) => {
    const def = parseGroupDef(g);
    if (seen.has(def.slug)) throw new Error(`duplicate group slug: ${def.slug}`);
    seen.add(def.slug);
    return def;
  });
  return { groups };
}

function parseGroupDef(raw: unknown): GroupDef {
  if (!raw || typeof raw !== "object") throw new Error("invalid group");
  const r = raw as Record<string, unknown>;
  const required = ["slug", "display_name", "x_handle", "data_file", "color"] as const;
  for (const k of required) {
    if (typeof r[k] !== "string" || (r[k] as string).length === 0) {
      throw new Error(`group missing required field: ${k}`);
    }
  }
  const def: GroupDef = {
    slug: String(r.slug),
    displayName: String(r.display_name),
    xHandle: String(r.x_handle),
    dataFile: String(r.data_file),
    color: String(r.color),
  };
  if (r.color_dark !== undefined) def.colorDark = String(r.color_dark);
  return def;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd web && pnpm test --run tests/data.test.ts
```
Expected: all data.test.ts tests pass (existing + new 4).

- [ ] **Step 5: Commit**

```bash
git add web/src/data.ts web/tests/data.test.ts
git commit -m "feat(web): add groups manifest parser"
```

---

## Task 8: Add stub data files for the two new groups

**Files:**
- Create: `data/shokuzai.json`
- Create: `data/mizutama.json`

These stubs let the site load empty tabs in development. They are placeholder commits — the user will replace them with real backfill output before merging (see Task 16).

- [ ] **Step 1: Write the stub for shokuzai**

Write the exact content below to `data/shokuzai.json`:

```json
{
  "$schema": "../schema/videos.schema.json",
  "generated_at": "2026-05-06T00:00:00Z",
  "last_synced_at": "2010-01-01T00:00:00Z",
  "source_query": "from:ofc_shokuzai has:videos -is:retweet",
  "videos": []
}
```

- [ ] **Step 2: Write the stub for mizutama**

Write the exact content below to `data/mizutama.json`:

```json
{
  "$schema": "../schema/videos.schema.json",
  "generated_at": "2026-05-06T00:00:00Z",
  "last_synced_at": "2010-01-01T00:00:00Z",
  "source_query": "from:oishii_mizutama has:videos -is:retweet",
  "videos": []
}
```

- [ ] **Step 3: Validate stubs against schema**

Run:
```bash
python - <<'PY'
import json, jsonschema, pathlib
schema = json.load(open("schema/videos.schema.json", encoding="utf-8"))
for slug in ("shokuzai", "mizutama"):
    payload = json.load(open(f"data/{slug}.json", encoding="utf-8"))
    payload.pop("$schema", None)
    jsonschema.validate(payload, schema)
print("ok")
PY
```
Expected: `ok`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add data/shokuzai.json data/mizutama.json
git commit -m "feat(data): add empty stubs for shokuzai and mizutama groups"
```

---

## Task 9: Update `web/index.html` for OISHII Movie Stock + tab nav placeholder

**Files:**
- Modify: `web/index.html`

- [ ] **Step 1: Replace `web/index.html` content**

Replace the entire file with:

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OISHII Movie Stock</title>

    <meta name="description" content="OISHII.inc 各グループ（美味しい曖昧 / 美味しい贖罪 / 美味しい水玉）の動画アーカイブ。X 投稿動画を一覧 / 検索 / 並び替えできる非公式ファンサイト。" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="OISHII Movie Stock" />
    <meta property="og:title" content="OISHII Movie Stock" />
    <meta property="og:description" content="OISHII.inc 各グループ（美味しい曖昧 / 美味しい贖罪 / 美味しい水玉）の動画アーカイブ。X 投稿動画を一覧 / 検索 / 並び替えできる非公式ファンサイト。" />
    <meta property="og:url" content="https://hitsumabushi845.github.io/aimai-x-movie-stock/" />
    <meta property="og:image" content="https://hitsumabushi845.github.io/aimai-x-movie-stock/oishii_movie_stock.png" />
    <meta property="og:image:width" content="1536" />
    <meta property="og:image:height" content="1024" />
    <meta property="og:image:alt" content="OISHII Movie Stock — Archive of videos from OISHII.inc groups (Unofficial)" />
    <meta property="og:locale" content="ja_JP" />

    <meta name="twitter:card" content="summary_large_image" />

    <link rel="stylesheet" href="/src/styles.css" />
  </head>
  <body>
    <header class="site-header">
      <div>
        <div class="site-title">OISHII Movie Stock</div>
        <div class="site-sub" id="site-sub"></div>
      </div>
      <a class="site-link" id="site-link" href="https://x.com/official_aimai" target="_blank" rel="noopener">X で見る →</a>
    </header>
    <nav class="tabs" id="tabs" role="tablist" aria-label="グループ"></nav>
    <div class="toolbar">
      <input id="q" type="search" placeholder="🔍 動画を検索（本文）" />
      <div class="sort" role="group" aria-label="並び順">
        <button data-sort="desc" class="active">新しい順</button>
        <button data-sort="asc">古い順</button>
      </div>
      <label class="filter">
        <input id="min-1m" type="checkbox" /> 1分以上のみ
      </label>
      <div id="count" class="count"></div>
    </div>
    <main id="list" class="list"></main>
    <div id="sentinel" data-sentinel></div>
    <footer class="site-footer">
      <span id="updated"></span>
      ·
      <a href="https://github.com/hitsumabushi845/aimai-x-movie-stock" target="_blank" rel="noopener">GitHub</a>
    </footer>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Confirm dev server still loads (will show empty tab nav and broken active group until Task 12 wires up the JS)**

This step is a sanity check; the rendered list will still show aimai because main.ts still uses the old DATA_URL constant after Task 3. It's OK for the tabs nav to be empty here. Run only if you want to spot HTML errors:

```bash
cd web && pnpm exec tsc --noEmit
```
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add web/index.html
git commit -m "feat(web): rebrand HTML to OISHII Movie Stock and add tabs nav placeholder"
```

---

## Task 10: Add `--group-accent` and `.tabs` styles

**Files:**
- Modify: `web/src/styles.css`

- [ ] **Step 1: Update `:root` to introduce `--group-accent` (default = X blue safety net)**

In `web/src/styles.css`, change the top `:root` block:

```css
:root {
  --bg: #ffffff;
  --fg: #111111;
  --muted: #888888;
  --accent: #1d9bf0;
  --border: #eeeeee;
  --row-hover: #f7f7f8;
  --row-open: #fafafa;
}
```

to:

```css
:root {
  --bg: #ffffff;
  --fg: #111111;
  --muted: #888888;
  --accent: #1d9bf0;
  --group-accent: var(--accent);
  --border: #eeeeee;
  --row-hover: #f7f7f8;
  --row-open: #fafafa;
}
```

- [ ] **Step 2: Replace existing `--accent` references with `--group-accent` for the styles that should follow the active group**

Find these three rules in `web/src/styles.css`:

```css
.site-link { color: var(--accent); font-size: 12px; text-decoration: none; }
```
```css
.play-btn.open { background: var(--accent); color: white; border-color: var(--accent); }
```

Replace each `var(--accent)` in those rules with `var(--group-accent)`. Keep other `--accent` references (none currently exist outside these two rules) untouched.

The result should read:

```css
.site-link { color: var(--group-accent); font-size: 12px; text-decoration: none; }
…
.play-btn.open { background: var(--group-accent); color: white; border-color: var(--group-accent); }
```

- [ ] **Step 3: Add the `.tabs` rule block before `.site-footer`**

Insert the following block in `web/src/styles.css` immediately before the `.site-footer` rule:

```css
.tabs {
  display: flex;
  gap: 4px;
  padding: 0 20px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  scrollbar-width: thin;
}
.tabs button {
  padding: 10px 16px;
  font-size: 13px;
  background: transparent;
  color: var(--muted);
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  white-space: nowrap;
}
.tabs button:hover { color: var(--fg); }
.tabs button[aria-selected="true"] {
  color: var(--fg);
  font-weight: 600;
  border-bottom-color: var(--group-accent);
}
```

- [ ] **Step 4: Add mobile overrides inside the `@media (max-width: 639px)` block**

Inside the existing `@media (max-width: 639px) { … }` rule, add:

```css
.tabs { padding: 0 14px; }
.tabs button {
  padding: 12px 14px;
  font-size: 13px;
  min-height: 44px;
}
```

- [ ] **Step 5: Commit**

```bash
git add web/src/styles.css
git commit -m "feat(web): add --group-accent variable and tabs styles"
```

---

## Task 11: Add `web/src/groups.ts` with theme + tab DOM helpers

**Files:**
- Create: `web/src/groups.ts`
- Create: `web/tests/groups.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `web/tests/groups.test.ts` with the following content:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { Window } from "happy-dom";
import {
  applyGroupTheme,
  buildTabs,
  resolveActiveGroup,
} from "../src/groups.js";
import type { GroupDef } from "../src/types.js";

const GROUPS: GroupDef[] = [
  { slug: "aimai", displayName: "美味しい曖昧", xHandle: "official_aimai",
    dataFile: "aimai.json", color: "#bc2956" },
  { slug: "shokuzai", displayName: "美味しい贖罪", xHandle: "ofc_shokuzai",
    dataFile: "shokuzai.json", color: "#1A1A1A", colorDark: "#f7f9f9" },
  { slug: "mizutama", displayName: "美味しい水玉", xHandle: "oishii_mizutama",
    dataFile: "mizutama.json", color: "#6CAAEF" },
];

let win: Window;
let doc: Document;

beforeEach(() => {
  win = new Window();
  doc = win.document as unknown as Document;
  // emulate <html> being available
  doc.documentElement.setAttribute("data-theme", "light");
});

describe("resolveActiveGroup", () => {
  it("returns the requested slug when valid", () => {
    expect(resolveActiveGroup(GROUPS, "shokuzai")).toBe("shokuzai");
  });
  it("falls back to the first group when slug is invalid", () => {
    expect(resolveActiveGroup(GROUPS, "ghost")).toBe("aimai");
  });
  it("falls back to the first group when slug is null", () => {
    expect(resolveActiveGroup(GROUPS, null)).toBe("aimai");
  });
});

describe("applyGroupTheme", () => {
  it("sets data-group on documentElement", () => {
    applyGroupTheme(doc as unknown as Document, GROUPS, "mizutama");
    expect(doc.documentElement.getAttribute("data-group")).toBe("mizutama");
  });
  it("injects per-group CSS custom properties (idempotent)", () => {
    applyGroupTheme(doc as unknown as Document, GROUPS, "mizutama");
    applyGroupTheme(doc as unknown as Document, GROUPS, "mizutama");
    const styles = doc.querySelectorAll('style[data-managed="groups"]');
    expect(styles.length).toBe(1);
    const css = styles[0].textContent ?? "";
    expect(css).toContain('[data-group="aimai"]');
    expect(css).toContain("#bc2956");
    expect(css).toContain('[data-group="shokuzai"]');
    expect(css).toContain('[data-theme="dark"][data-group="shokuzai"]');
    expect(css).toContain("#f7f9f9");
  });
});

describe("buildTabs", () => {
  it("renders one button per group with aria-selected reflecting active", () => {
    const nav = doc.createElement("nav");
    buildTabs(nav as unknown as HTMLElement, GROUPS, "shokuzai", () => {});
    const buttons = nav.querySelectorAll("button[role='tab']");
    expect(buttons.length).toBe(3);
    expect((buttons[0] as HTMLButtonElement).getAttribute("aria-selected")).toBe("false");
    expect((buttons[1] as HTMLButtonElement).getAttribute("aria-selected")).toBe("true");
    expect((buttons[1] as HTMLButtonElement).getAttribute("data-group")).toBe("shokuzai");
    expect((buttons[2] as HTMLButtonElement).getAttribute("tabindex")).toBe("-1");
    expect((buttons[1] as HTMLButtonElement).getAttribute("tabindex")).toBe("0");
  });

  it("invokes onSelect with the slug when a tab is clicked", () => {
    const nav = doc.createElement("nav");
    let last: string | null = null;
    buildTabs(nav as unknown as HTMLElement, GROUPS, "aimai", (slug) => {
      last = slug;
    });
    const target = nav.querySelectorAll("button[role='tab']")[2] as HTMLButtonElement;
    target.click();
    expect(last).toBe("mizutama");
  });

  it("re-render updates aria-selected and replaces previous buttons", () => {
    const nav = doc.createElement("nav");
    buildTabs(nav as unknown as HTMLElement, GROUPS, "aimai", () => {});
    buildTabs(nav as unknown as HTMLElement, GROUPS, "mizutama", () => {});
    expect(nav.querySelectorAll("button[role='tab']").length).toBe(3);
    const selected = nav.querySelector("button[aria-selected='true']");
    expect((selected as HTMLButtonElement).getAttribute("data-group")).toBe("mizutama");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd web && pnpm test --run tests/groups.test.ts
```
Expected: failure resolving import `../src/groups.js`.

- [ ] **Step 3: Implement `web/src/groups.ts`**

Create `web/src/groups.ts` with:

```ts
import type { GroupDef } from "./types.js";

const STYLE_ID = "groups-theme-style";

export function resolveActiveGroup(
  groups: GroupDef[],
  requested: string | null,
): string {
  if (requested && groups.some((g) => g.slug === requested)) return requested;
  return groups[0].slug;
}

export function applyGroupTheme(
  doc: Document,
  groups: GroupDef[],
  activeSlug: string,
): void {
  doc.documentElement.dataset.group = activeSlug;
  ensureStyleTag(doc, groups);
}

function ensureStyleTag(doc: Document, groups: GroupDef[]): void {
  let el = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = doc.createElement("style");
    el.id = STYLE_ID;
    el.dataset.managed = "groups";
    doc.head.appendChild(el);
  }
  el.textContent = generateGroupCss(groups);
}

function generateGroupCss(groups: GroupDef[]): string {
  const lines: string[] = [];
  for (const g of groups) {
    lines.push(`:root[data-group="${g.slug}"] { --group-accent: ${g.color}; }`);
    if (g.colorDark) {
      lines.push(
        `[data-theme="dark"][data-group="${g.slug}"] { --group-accent: ${g.colorDark}; }`,
      );
    }
  }
  return lines.join("\n");
}

export type TabSelectHandler = (slug: string) => void;

export function buildTabs(
  container: HTMLElement,
  groups: GroupDef[],
  activeSlug: string,
  onSelect: TabSelectHandler,
): void {
  container.replaceChildren();
  for (const g of groups) {
    const btn = container.ownerDocument.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "tab");
    btn.dataset.group = g.slug;
    btn.textContent = g.displayName;
    const active = g.slug === activeSlug;
    btn.setAttribute("aria-selected", active ? "true" : "false");
    btn.tabIndex = active ? 0 : -1;
    btn.addEventListener("click", () => onSelect(g.slug));
    container.appendChild(btn);
  }
}

export function updateHeaderForGroup(
  doc: Document,
  group: GroupDef,
): void {
  const sub = doc.getElementById("site-sub");
  if (sub) sub.textContent = `@${group.xHandle} の動画アーカイブ`;
  const link = doc.getElementById("site-link");
  if (link) link.setAttribute("href", `https://x.com/${group.xHandle}`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd web && pnpm test --run tests/groups.test.ts
```
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/groups.ts web/tests/groups.test.ts
git commit -m "feat(web): add groups module for theme and tab DOM"
```

---

## Task 12: Wire tabs and per-group loading into `web/src/main.ts`

**Files:**
- Modify: `web/src/main.ts`

This is the central refactor. The DATA_URL constant is removed; the boot flow becomes: load manifest → resolve active group from `?g=` → fetch only that group's data → render. Tab clicks lazy-load other groups, cache results, push state.

- [ ] **Step 1: Replace `web/src/main.ts` content**

Replace the entire file with:

```ts
import { loadVideosFile, loadGroupsManifest, sortVideos } from "./data.js";
import { createSearcher, type Searcher } from "./search.js";
import { renderList, replaceList, appendBatch } from "./render.js";
import { embedTweet } from "./embed.js";
import { initTheme } from "./theme.js";
import { initAnalytics } from "./analytics.js";
import {
  applyGroupTheme,
  buildTabs,
  resolveActiveGroup,
  updateHeaderForGroup,
} from "./groups.js";
import type { GroupDef, GroupsManifest, SortOrder, Video, VideosFile } from "./types.js";

const BATCH = 20;
const MANIFEST_URL = "./data/groups.json";
const MIN_1M = 60;

type GroupState = {
  videos: Video[];
  searcher: Searcher;
  generatedAt: string;
};

type State = {
  manifest: GroupsManifest;
  activeGroup: string;
  view: Video[];
  visible: number;
  order: SortOrder;
  query: string;
  minDurationSec: number;
};

async function bootstrap(): Promise<void> {
  initTheme();
  initAnalytics();

  const list = document.getElementById("list") as HTMLElement;
  const sentinel = document.getElementById("sentinel") as HTMLElement;
  const countEl = document.getElementById("count") as HTMLElement;
  const updatedEl = document.getElementById("updated") as HTMLElement;
  const search = document.getElementById("q") as HTMLInputElement;
  const sortBtns = document.querySelectorAll<HTMLButtonElement>(".sort button");
  const min1m = document.getElementById("min-1m") as HTMLInputElement;
  const tabsHost = document.getElementById("tabs") as HTMLElement;

  const manifest = await loadGroupsManifest(MANIFEST_URL);

  const url = new URL(window.location.href);
  const initialQuery = url.searchParams.get("q") ?? "";
  const initialMin1m = url.searchParams.get("min1m") === "1";
  const initialGroup = resolveActiveGroup(
    manifest.groups,
    url.searchParams.get("g"),
  );

  search.value = initialQuery;
  min1m.checked = initialMin1m;

  const state: State = {
    manifest,
    activeGroup: initialGroup,
    view: [],
    visible: 0,
    order: "desc",
    query: initialQuery,
    minDurationSec: initialMin1m ? MIN_1M : 0,
  };

  const groupCache = new Map<string, Promise<GroupState>>();

  async function loadGroup(slug: string): Promise<GroupState> {
    let pending = groupCache.get(slug);
    if (!pending) {
      const def = state.manifest.groups.find((g) => g.slug === slug)!;
      pending = (async () => {
        const file: VideosFile = await loadVideosFile(`./data/${def.dataFile}`);
        return {
          videos: file.videos,
          searcher: createSearcher(file.videos),
          generatedAt: file.generated_at,
        };
      })();
      groupCache.set(slug, pending);
    }
    return pending;
  }

  function findGroup(slug: string): GroupDef {
    return state.manifest.groups.find((g) => g.slug === slug)!;
  }

  function applyGroupChrome(slug: string): void {
    applyGroupTheme(document, state.manifest.groups, slug);
    updateHeaderForGroup(document, findGroup(slug));
  }

  async function recompute(): Promise<void> {
    const groupState = await loadGroup(state.activeGroup);
    updatedEl.textContent = `最終更新: ${groupState.generatedAt
      .replace("T", " ")
      .replace("Z", " UTC")}`;
    const searched = state.query
      ? groupState.searcher.search(state.query)
      : groupState.videos;
    const filtered =
      state.minDurationSec > 0
        ? searched.filter((v) => v.duration_sec >= state.minDurationSec)
        : searched;
    state.view = sortVideos(filtered, state.order);
    state.visible = Math.min(BATCH, state.view.length);
    countEl.textContent = `全 ${state.view.length} 件`;
    replaceList(list, state.view.slice(0, state.visible), { embed: embedTweet });
    sentinel.style.display = state.visible < state.view.length ? "" : "none";
  }

  function appendNext(): void {
    if (state.visible >= state.view.length) return;
    const next = state.view.slice(state.visible, state.visible + BATCH);
    state.visible += next.length;
    appendBatch(list, next, { embed: embedTweet });
    if (state.visible >= state.view.length) sentinel.style.display = "none";
  }

  async function selectGroup(slug: string, push: boolean): Promise<void> {
    if (slug === state.activeGroup) return;
    state.activeGroup = slug;
    applyGroupChrome(slug);
    buildTabs(tabsHost, state.manifest.groups, slug, (s) => {
      void selectGroup(s, true);
    });
    syncUrl(state, push);
    await recompute();
  }

  // Initial chrome and tab render
  applyGroupChrome(state.activeGroup);
  buildTabs(tabsHost, state.manifest.groups, state.activeGroup, (slug) => {
    void selectGroup(slug, true);
  });

  search.addEventListener("input", () => {
    state.query = search.value;
    syncUrl(state, false);
    void recompute();
  });

  for (const btn of sortBtns) {
    btn.addEventListener("click", () => {
      const order = btn.dataset.sort as SortOrder;
      state.order = order;
      sortBtns.forEach((b) => b.classList.toggle("active", b === btn));
      void recompute();
    });
  }

  min1m.addEventListener("change", () => {
    state.minDurationSec = min1m.checked ? MIN_1M : 0;
    syncUrl(state, false);
    void recompute();
  });

  window.addEventListener("popstate", () => {
    const u = new URL(window.location.href);
    const newQuery = u.searchParams.get("q") ?? "";
    const newMin1m = u.searchParams.get("min1m") === "1";
    const newGroup = resolveActiveGroup(state.manifest.groups, u.searchParams.get("g"));
    state.query = newQuery;
    search.value = newQuery;
    state.minDurationSec = newMin1m ? MIN_1M : 0;
    min1m.checked = newMin1m;
    if (newGroup !== state.activeGroup) {
      state.activeGroup = newGroup;
      applyGroupChrome(newGroup);
      buildTabs(tabsHost, state.manifest.groups, newGroup, (s) => {
        void selectGroup(s, true);
      });
    }
    void recompute();
  });

  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) appendNext();
  });
  io.observe(sentinel);

  await recompute();
}

function syncUrl(state: State, push: boolean): void {
  const url = new URL(window.location.href);
  if (state.query) url.searchParams.set("q", state.query);
  else url.searchParams.delete("q");
  if (state.minDurationSec > 0) url.searchParams.set("min1m", "1");
  else url.searchParams.delete("min1m");
  const defaultSlug = state.manifest.groups[0].slug;
  if (state.activeGroup && state.activeGroup !== defaultSlug) {
    url.searchParams.set("g", state.activeGroup);
  } else {
    url.searchParams.delete("g");
  }
  if (push) window.history.pushState(null, "", url.toString());
  else window.history.replaceState(null, "", url.toString());
}

bootstrap().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML(
    "beforeend",
    `<pre style="color:red;padding:16px">${String(e)}</pre>`,
  );
});
```

- [ ] **Step 2: Verify the existing `Searcher` export in `web/src/search.ts`**

The new `main.ts` imports `Searcher` from `./search.js`. Confirm that `web/src/search.ts` already exports a `Searcher` type (it does — `export type Searcher = { search(query: string): Video[]; }`). No change needed here unless the export was removed; if missing, re-add it.

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd web && pnpm exec tsc --noEmit
```
Expected: no output, exit 0.

- [ ] **Step 4: Run all web tests**

Run:
```bash
cd web && pnpm test
```
Expected: every test passes (including the new `groups.test.ts` and `data.test.ts` additions). Note: `index-html.test.ts` will fail because the title and OGP have changed — that is fixed in the next task.

If `index-html.test.ts` was the only failure, that's expected. Other failures must be diagnosed and fixed before continuing.

- [ ] **Step 5: Smoke-test in the browser**

Run:
```bash
cd web && pnpm dev
```
Open `http://localhost:5173` and verify:
- 3 tabs render at the top with the names "美味しい曖昧 / 美味しい贖罪 / 美味しい水玉"
- Default tab is aimai with the existing video list
- Header sub reads "@official_aimai の動画アーカイブ"
- Clicking shokuzai tab changes URL to `?g=shokuzai`, header sub updates to "@ofc_shokuzai の動画アーカイブ", X link points to `https://x.com/ofc_shokuzai`, list shows empty (stub data) with "全 0 件"
- Clicking mizutama similarly works
- Clicking back to aimai removes `?g=` from URL and the original list returns
- Browser back/forward navigates between tabs
- Theme color of "▶ 再生" → "閉じる" toggles the per-group color (open a video on aimai vs mizutama and confirm visually)

Stop the dev server (`Ctrl-C`).

- [ ] **Step 6: Commit**

```bash
git add web/src/main.ts
git commit -m "feat(web): wire tabs, per-group lazy loading, URL state, and popstate"
```

---

## Task 13: Update `web/tests/index-html.test.ts`

**Files:**
- Modify: `web/tests/index-html.test.ts`

- [ ] **Step 1: Replace the constants and add a tabs assertion**

Replace the entire content of `web/tests/index-html.test.ts` with:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { Window } from "happy-dom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(
  path.join(__dirname, "..", "index.html"),
  "utf-8",
);

const SITE_URL = "https://hitsumabushi845.github.io/aimai-x-movie-stock/";
const IMAGE_URL = `${SITE_URL}oishii_movie_stock.png`;
const DESCRIPTION =
  "OISHII.inc 各グループ（美味しい曖昧 / 美味しい贖罪 / 美味しい水玉）の動画アーカイブ。X 投稿動画を一覧 / 検索 / 並び替えできる非公式ファンサイト。";
const IMAGE_ALT =
  "OISHII Movie Stock — Archive of videos from OISHII.inc groups (Unofficial)";
const SITE_TITLE = "OISHII Movie Stock";

function parseHead(): Document {
  const window = new Window();
  window.document.write(html);
  return window.document as unknown as Document;
}

function metaContent(
  doc: Document,
  attr: "name" | "property",
  key: string,
): string | null {
  const el = doc.querySelector(`meta[${attr}="${key}"]`);
  return el ? el.getAttribute("content") : null;
}

describe("index.html metadata", () => {
  let doc: Document;
  beforeAll(() => {
    doc = parseHead();
  });

  it("has the OISHII Movie Stock title", () => {
    const t = doc.querySelector("title");
    expect(t?.textContent).toBe(SITE_TITLE);
  });

  it("has a non-empty meta description", () => {
    expect(metaContent(doc, "name", "description")).toBe(DESCRIPTION);
  });

  it("has og:type = website", () => {
    expect(metaContent(doc, "property", "og:type")).toBe("website");
  });

  it("has og:site_name", () => {
    expect(metaContent(doc, "property", "og:site_name")).toBe(SITE_TITLE);
  });

  it("has og:title matching the page title", () => {
    expect(metaContent(doc, "property", "og:title")).toBe(SITE_TITLE);
  });

  it("has og:description", () => {
    expect(metaContent(doc, "property", "og:description")).toBe(DESCRIPTION);
  });

  it("has og:url as canonical absolute URL", () => {
    expect(metaContent(doc, "property", "og:url")).toBe(SITE_URL);
  });

  it("has og:image as absolute URL pointing to the share PNG", () => {
    expect(metaContent(doc, "property", "og:image")).toBe(IMAGE_URL);
  });

  it("declares og:image dimensions matching the source PNG", () => {
    expect(metaContent(doc, "property", "og:image:width")).toBe("1536");
    expect(metaContent(doc, "property", "og:image:height")).toBe("1024");
  });

  it("has og:image:alt", () => {
    expect(metaContent(doc, "property", "og:image:alt")).toBe(IMAGE_ALT);
  });

  it("has og:locale = ja_JP", () => {
    expect(metaContent(doc, "property", "og:locale")).toBe("ja_JP");
  });

  it("uses summary_large_image for the Twitter card", () => {
    expect(metaContent(doc, "name", "twitter:card")).toBe(
      "summary_large_image",
    );
  });
});

describe("index.html structure", () => {
  let doc: Document;
  beforeAll(() => {
    doc = parseHead();
  });

  it("includes an empty tabs nav placeholder for JS-driven tab rendering", () => {
    const tabs = doc.getElementById("tabs");
    expect(tabs).not.toBeNull();
    expect(tabs?.getAttribute("role")).toBe("tablist");
    expect(tabs?.children.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run all web tests**

Run:
```bash
cd web && pnpm test
```
Expected: every test passes.

- [ ] **Step 3: Commit**

```bash
git add web/tests/index-html.test.ts
git commit -m "test(web): update index.html metadata assertions for OISHII rebrand"
```

---

## Task 14: Update `update-data.yml` to matrix scrape + aggregate PR

**Files:**
- Modify: `.github/workflows/update-data.yml`

- [ ] **Step 1: Replace the workflow content**

Replace the entire content of `.github/workflows/update-data.yml` with:

```yaml
name: update-data

on:
  schedule:
    - cron: "0 18 * * 1"
  workflow_dispatch: {}

permissions:
  contents: write
  pull-requests: write

concurrency:
  group: update-data
  cancel-in-progress: false

jobs:
  scrape:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    strategy:
      fail-fast: false
      matrix:
        group: [aimai, shokuzai, mizutama]
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
      - uses: astral-sh/setup-uv@caf0cab7a618c569241d31dcd442f54681755d39 # v3.2.4
        with:
          python-version: "3.12"
      - name: Install
        working-directory: scraper
        run: uv sync --frozen
      - name: Run scraper for ${{ matrix.group }}
        working-directory: scraper
        env:
          X_BEARER_TOKEN: ${{ secrets.X_BEARER_TOKEN }}
        run: |
          uv run python -m scraper \
            --group ${{ matrix.group }} \
            --manifest ../data/groups.json \
            --manifest-schema ../schema/groups.schema.json \
            --schema ../schema/videos.schema.json \
            --data-dir ../data \
            --require-existing \
            --summary-out "$GITHUB_STEP_SUMMARY"
      - uses: actions/upload-artifact@b4b15b8c7c6ac21ea08fcf65892d2ee8f75cf882 # v4.4.3
        with:
          name: data-${{ matrix.group }}
          path: data/${{ matrix.group }}.json
          retention-days: 1

  open-pr:
    needs: scrape
    if: always()
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
      - uses: actions/download-artifact@fa0a91b85d4f404e444e00e005971372dc801d16 # v4.1.8
        with:
          path: _artifacts
      - name: Stage updated per-group files
        run: |
          set -e
          if [ -d _artifacts ]; then
            for f in _artifacts/data-*/*.json; do
              [ -e "$f" ] || continue
              cp "$f" data/
            done
          fi
      - name: Detect changes
        id: diff
        run: |
          if git diff --quiet -- data/; then
            echo "changed=false" >> "$GITHUB_OUTPUT"
          else
            echo "changed=true" >> "$GITHUB_OUTPUT"
          fi
      - name: Create Pull Request
        if: steps.diff.outputs.changed == 'true'
        uses: peter-evans/create-pull-request@22a9089034f40e5a961c8808d113e2c98fb63676 # v7.0.11
        with:
          commit-message: "chore(data): update per-group videos.json"
          title: "chore(data): weekly per-group videos.json update"
          body: |
            Auto-generated by `update-data.yml`.

            See workflow run summary for per-group scrape stats.
          branch: bot/update-data
          delete-branch: true
          add-paths: data/*.json
      - name: Notify Slack on failure
        if: failure()
        uses: slackapi/slack-github-action@fcfb566f8b0aab22203f066d80ca1d7e4b5d05b3 # v1.27.1
        with:
          payload: |
            {
              "text": ":x: update-data failed: <${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|run #${{ github.run_id }}>"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          SLACK_WEBHOOK_TYPE: INCOMING_WEBHOOK
```

- [ ] **Step 2: Lint workflow YAML (best-effort)**

Run:
```bash
python - <<'PY'
import yaml
yaml.safe_load(open(".github/workflows/update-data.yml"))
print("ok")
PY
```
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/update-data.yml
git commit -m "ci(update-data): matrix scrape per group with aggregated PR"
```

---

## Task 15: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update key sections**

Apply these specific edits to `README.md`:

(a) Replace the first paragraph (line 3) with:
```markdown
OISHII.inc 各グループ（美味しい曖昧 / 美味しい贖罪 / 美味しい水玉）の公式 X が投稿した動画（特にライブダイジェスト）を、グループ別タブで一覧表示する静的サイト。GitHub Pages でホスティングし、データは GitHub Actions の週次 cron で更新される。
```

(b) Under `## Stack`, replace the `**scraper/**` and `**web/**` bullets with:
```markdown
- **scraper/**: Python 3.12 + uv + httpx → X API v2 `search/all` を呼び、`data/groups.json` を駆動して各グループの `data/<slug>.json` を更新
- **web/**: Vite + TypeScript + Fuse.js — `data/groups.json` を fetch、active グループの `data/<slug>.json` を遅延 fetch して描画。タブで切り替え。
```

(c) Replace the `## 機能` section to add the tab feature line:
```markdown
- ✅ 3 グループ（美味しい曖昧 / 美味しい贖罪 / 美味しい水玉）のタブ切り替え（`?g=<slug>`）
- ✅ グループごとのテーマカラー（タブ・再生ボタン・外部リンク）
- ✅ 投稿日時 / 動画長 / 本文の一覧表示（コンパクトリスト）
- ✅ クリックで X 埋め込みを inline 展開（複数同時可、widgets.js は遅延ロード）
- ✅ フリーワード検索（本文 + tags、Fuse.js でファジー）
- ✅ 並び順切り替え（新しい順 / 古い順）
- ✅ 動画長 1 分以上のみフィルタ
- ✅ 無限スクロール
- ✅ システムテーマ追従（`prefers-color-scheme`）
- ✅ 検索 / フィルタ / タブ状態を URL に同期（`?g=...&q=foo&min1m=1`）
```

(d) Replace section 3 (`**初回バックフィル**`) with:
```markdown
3. **初回バックフィル**（ローカルで 1 度だけ）

   ```bash
   set -a; source .env; set +a   # bash; fish の場合は env 読み込みを適宜
   uv run python -m scraper --all \
     --manifest ../data/groups.json \
     --manifest-schema ../schema/groups.schema.json \
     --schema ../schema/videos.schema.json \
     --data-dir ../data \
     --backfill
   ```

   `data/aimai.json` / `data/shokuzai.json` / `data/mizutama.json` が生成 / 上書きされるので commit & push:

   ```bash
   cd ..
   git add data/*.json
   git commit -m "feat(data): initial backfill of per-group videos.json"
   git push
   ```
```

(e) Replace the file-tree block in `## ローカル開発` with:
```
.
├── data/
│   ├── groups.json           ← グループ定義（slug / 表示名 / X ハンドル / テーマ色）
│   ├── aimai.json            ← @official_aimai
│   ├── shokuzai.json         ← @ofc_shokuzai
│   └── mizutama.json         ← @oishii_mizutama
├── schema/
│   ├── groups.schema.json
│   └── videos.schema.json
├── scraper/                  ← Python パッケージ
│   ├── src/scraper/...
│   └── tests/
└── web/                      ← Vite + TS フロントエンド
    ├── src/...
    └── tests/
```

(f) Append a new section before `## ライセンス`:
```markdown
## グループを追加するには

1. `data/groups.json` の `groups` 配列にエントリを追加（slug / display_name / x_handle / data_file / color、必要なら color_dark）。
2. ローカルで `--group <slug> --backfill` を実行して per-group ファイルを生成し、コミット。
3. `.github/workflows/update-data.yml` の matrix `group:` 配列に slug を追加。
4. CI / Pages デプロイは `data/*.json` を path filter で拾うので追加変更は不要。

```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for multi-group support"
```

---

## Task 16: User actions before merging (NOT a code change)

This task is operational — flag the items that must be done by the user before the PR can be merged. Do NOT mark this completed in CI; mark it on the PR description.

- [ ] **Step 1: Run the real backfill for the new groups**

With a populated `.env` containing `X_BEARER_TOKEN`:

```bash
cd scraper
set -a; source .env; set +a   # adapt to your shell
uv run python -m scraper --group shokuzai \
  --manifest ../data/groups.json \
  --manifest-schema ../schema/groups.schema.json \
  --schema ../schema/videos.schema.json \
  --data-dir ../data \
  --backfill
uv run python -m scraper --group mizutama \
  --manifest ../data/groups.json \
  --manifest-schema ../schema/groups.schema.json \
  --schema ../schema/videos.schema.json \
  --data-dir ../data \
  --backfill
cd ..
```

This overwrites the empty stubs from Task 8 with real data.

- [ ] **Step 2: Verify file sizes look reasonable and schema-valid**

```bash
for f in data/aimai.json data/shokuzai.json data/mizutama.json; do
  python -c "import json; d=json.load(open('$f')); print('$f', len(d['videos']))"
done
```
Expected: each file prints a non-negative count; aimai should match the previous count, shokuzai/mizutama should be > 0 (if the accounts have public videos).

- [ ] **Step 3: Place the OGP image**

Save `oishii_movie_stock.png` (1536×1024 PNG) into `web/public/`. Commit it:

```bash
git add web/public/oishii_movie_stock.png data/shokuzai.json data/mizutama.json data/aimai.json
git commit -m "feat(data,web): real backfill + OISHII OGP share image"
```

- [ ] **Step 4: Final verification**

```bash
make test
cd web && pnpm build
```

Both should succeed. Open the built `web/dist/index.html` (e.g., `pnpm preview`) and verify:
- All 3 tabs show real content
- The OGP debugger (e.g., `https://www.opengraph.xyz/`) renders the new image and copy after deployment

- [ ] **Step 5: Push the branch and open a PR**

```bash
git push -u origin feat/multi-group-tabs
gh pr create --title "feat: multi-group tabs (OISHII Movie Stock)" --body "$(cat <<'EOF'
## Summary
- Scale the site from one X account to OISHII.inc's 3 groups (aimai / shokuzai / mizutama).
- Tabs at the top of the page; per-group accent color; URL syncs `?g=<slug>`.
- Manifest-driven configuration in `data/groups.json`, scraper `--group/--all/--manifest`.
- Matrix scrape workflow with aggregated weekly PR.
- Site-wide rebrand to "OISHII Movie Stock" + new OGP image.

## Test plan
- [ ] `make test` passes
- [ ] `pnpm build` succeeds
- [ ] Tabs switch correctly with theme color changes
- [ ] Search/filter/sort persist across tab switches
- [ ] `?g=<slug>` works as a direct link
- [ ] Browser back/forward navigates between tabs
- [ ] dark theme + shokuzai uses the light fallback color
- [ ] OGP renders correctly in opengraph.xyz

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review checklist (run after the plan is fully written)

Spec coverage map:

| Spec section | Implemented in |
| ------------ | -------------- |
| Manifest `data/groups.json` | Task 2 |
| Manifest schema `schema/groups.schema.json` | Task 1 |
| Per-group videos files | Tasks 3 (aimai rename), 8 (stubs), 16 (real backfill) |
| Scraper `groups.py` | Task 4 |
| Scraper CLI `--group/--all/--manifest` w/ legacy compat | Task 5 |
| Web types | Task 6 |
| Web manifest parser | Task 7 |
| Web `groups.ts` (theme + tabs + slug resolver) | Task 11 |
| Web `main.ts` state + lazy load + cache + popstate + URL | Task 12 |
| HTML rebrand + tabs nav placeholder | Task 9 |
| CSS `--group-accent` + `.tabs` | Task 10 |
| index-html test updates | Task 13 |
| Workflow matrix + aggregate PR | Task 14 |
| `ci.yml` schema-validate iterates per-group + manifest | Task 3 (Step 4) |
| `deploy.yml` path filter follows new layout | Task 3 (Step 3) |
| README updates | Task 15 |
| OGP image asset | Task 16 (user-provided) |
| Real backfill before merge | Task 16 |
