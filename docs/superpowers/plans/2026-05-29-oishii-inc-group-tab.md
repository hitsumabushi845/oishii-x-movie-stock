# OISHII.inc Group Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the OISHII.inc official X account `@oishii_inc` as a 4th tab, managed identically to the existing three groups.

**Architecture:** The repo is manifest-driven — `data/groups.json` is the single source of truth, and the web frontend, scraper, and CI all read it dynamically. Adding a group requires only data/config additions: a manifest entry, an empty per-group videos file, and a workflow matrix entry. No application code changes.

**Tech Stack:** JSON data files, JSON Schema validation (`jsonschema`), Python scraper (uv), TypeScript/Vite web, GitHub Actions.

---

## File Structure

- `data/groups.json` — **Modify.** Add the `oishii_inc` group object to the `groups` array.
- `data/oishii_inc.json` — **Create.** Empty per-group videos file (`videos: []`) conforming to `schema/videos.schema.json`.
- `.github/workflows/update-data.yml` — **Modify.** Add `oishii_inc` to the scrape matrix.

No web/scraper source or test changes: web tests use a local `GROUPS` fixture (not the real manifest), and CI/scraper iterate the manifest generically.

---

### Task 1: Add the `oishii_inc` group to the manifest

**Files:**
- Modify: `data/groups.json`

- [ ] **Step 1: Add the group entry**

In `data/groups.json`, add a new object as the last element of the `groups` array (after the `mizutama` entry). The `mizutama` object currently ends at line 24 (`}`) before the closing `]`. Add a comma after that closing brace and insert:

```json
    {
      "slug": "oishii_inc",
      "display_name": "OISHII.inc",
      "x_handle": "oishii_inc",
      "data_file": "oishii_inc.json",
      "color": "#6B7280",
      "color_dark": "#FFFFFF"
    }
```

The resulting `groups` array tail should look like:

```json
    {
      "slug": "mizutama",
      "display_name": "美味しい水玉",
      "x_handle": "oishii_mizutama",
      "data_file": "mizutama.json",
      "color": "#6CAAEF"
    },
    {
      "slug": "oishii_inc",
      "display_name": "OISHII.inc",
      "x_handle": "oishii_inc",
      "data_file": "oishii_inc.json",
      "color": "#6B7280",
      "color_dark": "#FFFFFF"
    }
  ]
}
```

- [ ] **Step 2: Verify the JSON parses**

Run: `python -c "import json; json.load(open('data/groups.json')); print('ok')"`
Expected: `ok` (no JSON parse error / trailing comma error).

- [ ] **Step 3: Do not commit yet**

Commit happens in Task 3 after the data file exists, so the manifest never points at a missing file in a committed state.

---

### Task 2: Create the empty per-group videos file

**Files:**
- Create: `data/oishii_inc.json`

- [ ] **Step 1: Create the file**

Create `data/oishii_inc.json` with exactly this content:

```json
{
  "$schema": "../schema/videos.schema.json",
  "generated_at": "2026-05-29T00:00:00Z",
  "last_synced_at": "2026-05-29T00:00:00Z",
  "source_query": "from:oishii_inc has:videos -is:retweet",
  "videos": []
}
```

This matches the shape of `data/mizutama.json` (same required keys: `generated_at`, `last_synced_at`, `source_query`, `videos`). `videos.schema.json` allows an empty `videos` array (no `minItems`).

- [ ] **Step 2: Verify it validates against the schema**

Run:
```bash
python - <<'PY'
import json, jsonschema
schema = json.load(open("schema/videos.schema.json"))
payload = json.load(open("data/oishii_inc.json"))
payload.pop("$schema", None)
jsonschema.validate(payload, schema)
print("ok")
PY
```
Expected: `ok`. (If `jsonschema` is not installed, run `pip install jsonschema==4.22.0` first — this is the version CI uses.)

---

### Task 3: Validate the full manifest + commit data changes

**Files:**
- (no new files) — validates Task 1 + Task 2 together, then commits both.

- [ ] **Step 1: Run the full-manifest dry-run scrape**

Run: `make scrape-dry`
Expected: command exits 0. It loads `data/groups.json`, iterates all four groups (including `oishii_inc`), and validates each per-group file against the schema in dry-run mode (no network writes). No schema/validation errors for `oishii_inc`.

- [ ] **Step 2: Reproduce the CI schema-validate check locally**

Run:
```bash
python - <<'PY'
import json, pathlib, jsonschema
data_dir = pathlib.Path("data")
videos_schema = json.load(open("schema/videos.schema.json"))
groups_schema = json.load(open("schema/groups.schema.json"))
manifest = json.load(open(data_dir / "groups.json"))
manifest_check = {k: v for k, v in manifest.items() if k != "$schema"}
jsonschema.validate(manifest_check, groups_schema)
for group in manifest["groups"]:
    path = data_dir / group["data_file"]
    assert path.exists(), f"missing data file: {path}"
    payload = json.load(open(path)); payload.pop("$schema", None)
    jsonschema.validate(payload, videos_schema)
print("ok")
PY
```
Expected: `ok`. This mirrors `.github/workflows/ci.yml` `schema-validate` exactly, confirming the manifest entry and the new data file both pass and the file exists.

- [ ] **Step 3: Commit the manifest + data file together**

```bash
git add data/groups.json data/oishii_inc.json
git commit -m "feat(data): add @oishii_inc group with empty seed file"
```

---

### Task 4: Add `oishii_inc` to the update-data workflow matrix

**Files:**
- Modify: `.github/workflows/update-data.yml:23`

- [ ] **Step 1: Add the slug to the matrix**

In `.github/workflows/update-data.yml`, change line 23 from:

```yaml
        group: [aimai, shokuzai, mizutama]
```

to:

```yaml
        group: [aimai, shokuzai, mizutama, oishii_inc]
```

No other workflow changes are needed. The scraper step is parameterized by `${{ matrix.group }}` and runs with `--require-existing`, which is satisfied because `data/oishii_inc.json` now exists (Task 2/3). No new GitHub Actions are introduced, so no `pinact` SHA-pinning step is required.

- [ ] **Step 2: Verify the YAML parses**

Run: `python -c "import yaml; yaml.safe_load(open('.github/workflows/update-data.yml')); print('ok')"`
Expected: `ok`. (If `pyyaml` is missing, `pip install pyyaml` first.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/update-data.yml
git commit -m "ci(update-data): add oishii_inc to scrape matrix"
```

---

### Task 5: Manual verification in the web app

**Files:**
- (none) — verification only.

- [ ] **Step 1: Build the web bundle**

Run: `make web-build`
Expected: `tsc` type-check passes and `vite build` succeeds with no errors.

- [ ] **Step 2: Start the dev server**

Run: `make web-dev`
Expected: Vite serves the site (note the local URL).

- [ ] **Step 3: Verify the new tab**

In a browser at the dev URL:
- A 4th tab labelled **OISHII.inc** appears alongside 美味しい曖昧 / 美味しい贖罪 / 美味しい水玉.
- Selecting it switches the active group (URL gains `?g=oishii_inc`) and shows an empty video list (no crash on `videos: []`).
- Toggle light/dark theme: the OISHII.inc accent (tab underline / play button / site link) is readable in **both** themes — grey `#6B7280` on light, white `#FFFFFF` on dark.

Expected: all of the above hold. If the accent is hard to read in light theme, revisit the `color` value in `data/groups.json`.

---

### Task 6: Pre-commit review

- [ ] **Step 1: Run the project review command**

Per `CLAUDE.md`, run `/codex:review` before finalizing. Address any findings, then ensure all changes from Tasks 1–4 are committed.

---

## Notes on README

`README.md`'s "グループを追加するには" section is generic and needs no change. If a separate place enumerates the current group list verbatim, append `oishii_inc` there; otherwise leave the README as-is.
