# Google Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google Analytics (GA4, Measurement ID `G-JPZZP8M3SR`) to the production build of the web frontend, gated by `import.meta.env.PROD` so dev/test builds don't send data.

**Architecture:** New module `web/src/analytics.ts` exports `initAnalytics()` which (in PROD only) injects the `gtag.js` script tag and calls `gtag('config', ...)`. `web/src/main.ts` calls it from `bootstrap()`, alongside `initTheme()`. No HTML changes, no new dependencies, no new tests (per approved spec).

**Tech Stack:** TypeScript, Vite 5, pnpm workspace. Vite replaces `import.meta.env.PROD` at build time, so the entire body of `initAnalytics` is tree-shaken from dev/test bundles.

**Spec:** [`docs/superpowers/specs/2026-05-03-google-analytics-design.md`](../specs/2026-05-03-google-analytics-design.md)

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `web/src/analytics.ts` | Self-contained GA initializer; declares minimal `gtag`/`dataLayer` types on `Window`; exports `initAnalytics()`. | Create |
| `web/src/main.ts` | Wires `initAnalytics()` into the existing `bootstrap()` flow next to `initTheme()`. | Modify (lines 1–6 imports, line 23 inside `bootstrap`) |

No tests are added (existing pattern: `theme.ts` has no tests either; spec rationale: testing the PROD-guard re-implements GA itself). Verification is done by typecheck + build inspection.

---

### Task 1: Create the analytics module

**Files:**
- Create: `web/src/analytics.ts`

- [ ] **Step 1: Create `web/src/analytics.ts` with the full module body**

Create the file with exactly this content:

```ts
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

const MEASUREMENT_ID = "G-JPZZP8M3SR";

export function initAnalytics(): void {
  if (!import.meta.env.PROD) return;

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID);
}

export {};
```

Notes for the implementer:
- The trailing `export {}` is required so TypeScript treats the file as a module and the `declare global` block is honored (this file already has an `export function`, but keeping the explicit `export {}` makes intent clear if the function is removed later).
- Do **not** convert `function () { window.dataLayer.push(arguments); }` to an arrow function — `arguments` requires a non-arrow function. This is the canonical GA snippet shape.
- `MEASUREMENT_ID` is a public, non-secret identifier; it is fine to commit.

- [ ] **Step 2: Typecheck the new file**

Run from the repo root:

```bash
pnpm -F web exec tsc -p tsconfig.json --noEmit
```

Expected: exits 0 with no output. If you see `Property 'dataLayer' does not exist on type 'Window'`, the `declare global` block is wrong — re-check it.

---

### Task 2: Wire `initAnalytics()` into `bootstrap()`

**Files:**
- Modify: `web/src/main.ts:1-6` (imports), `web/src/main.ts:22-24` (`bootstrap` head)

- [ ] **Step 1: Add the import**

In `web/src/main.ts`, after line 5 (`import { initTheme } from "./theme.js";`), add:

```ts
import { initAnalytics } from "./analytics.js";
```

The `.js` extension (not `.ts`) matches the existing pattern in this file — Vite/TS resolves it correctly under `"type": "module"`.

- [ ] **Step 2: Call `initAnalytics()` in `bootstrap()`**

In `web/src/main.ts`, modify the `bootstrap()` function head. Change:

```ts
async function bootstrap(): Promise<void> {
  initTheme();
```

to:

```ts
async function bootstrap(): Promise<void> {
  initTheme();
  initAnalytics();
```

The call must come before any awaits so that `gtag('config', ...)` runs synchronously during initial page load — this is what fires the auto page_view event.

- [ ] **Step 3: Typecheck the wired-up module**

Run:

```bash
pnpm -F web exec tsc -p tsconfig.json --noEmit
```

Expected: exits 0 with no output.

- [ ] **Step 4: Run the existing test suite to confirm no regression**

Run from the repo root:

```bash
make test
```

Expected: scraper pytest and web vitest both pass. The web side runs with `import.meta.env.PROD === false`, so `initAnalytics()` returns early — no DOM mutation, no network call.

---

### Task 3: Verify production build emits GA, dev does not

**Files:** none (verification only)

- [ ] **Step 1: Build for production**

Run:

```bash
pnpm -F web build
```

Expected: build succeeds. Output ends with `✓ built in ...`.

- [ ] **Step 2: Confirm GA URL is in the production bundle**

Run from the repo root:

```bash
grep -r "googletagmanager.com" web/dist/
```

Expected: at least one match in `web/dist/assets/*.js`. If there are zero matches, the PROD guard removed too much — re-check that the import path is `./analytics.js` and that `initAnalytics()` is actually called from `main.ts`.

- [ ] **Step 3: Manual smoke test in preview**

Run:

```bash
pnpm -F web preview
```

Open the printed URL (default `http://localhost:4173/aimai-x-movie-stock/` or similar) in a browser, open DevTools → Network, filter for `googletagmanager`. Expected: one request to `https://www.googletagmanager.com/gtag/js?id=G-JPZZP8M3SR` with HTTP 200, plus follow-up requests to `google-analytics.com/g/collect`.

If you do not have a browser available in your environment, skip this step and note it in the commit; the build inspection in Step 2 is the load-bearing check.

- [ ] **Step 4: Confirm dev server does NOT load GA**

In a separate terminal, run:

```bash
make web-dev
```

Open `http://localhost:5173/`, DevTools → Network, filter for `googletagmanager`. Expected: zero requests. Stop the dev server (Ctrl-C) when done.

If you do not have a browser available, skip this step. The semantics of `import.meta.env.PROD` plus the build inspection together provide sufficient evidence.

---

### Task 4: Commit

**Files:** none (git only)

- [ ] **Step 1: Stage the changes**

```bash
git add web/src/analytics.ts web/src/main.ts
```

- [ ] **Step 2: Verify staged diff matches expectations**

```bash
git diff --cached --stat
```

Expected output (file list and line counts may vary by ±1):

```
 web/src/analytics.ts | 26 ++++++++++++++++++++++++++
 web/src/main.ts      |  2 ++
 2 files changed, 28 insertions(+)
```

If `web/src/main.ts` shows more than ~2 insertions, you accidentally modified other code — back out and redo.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(web): add Google Analytics (GA4) for production builds"
```

- [ ] **Step 4: Verify commit landed**

```bash
git log -1 --stat
```

Expected: HEAD is the new commit, touching exactly `web/src/analytics.ts` and `web/src/main.ts`.

---

## Done criteria

- [ ] `web/src/analytics.ts` exists and exports `initAnalytics()`.
- [ ] `web/src/main.ts` calls `initAnalytics()` from `bootstrap()` immediately after `initTheme()`.
- [ ] `pnpm -F web exec tsc -p tsconfig.json --noEmit` passes.
- [ ] `make test` passes.
- [ ] `pnpm -F web build` produces a bundle in which `grep -r "googletagmanager.com" web/dist/` returns at least one hit.
- [ ] Single commit on the branch with the message above.
