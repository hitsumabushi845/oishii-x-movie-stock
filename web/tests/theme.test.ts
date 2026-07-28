import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Window } from "happy-dom";
import { applyMode, nextMode, readMode, THEME_STORAGE_KEY } from "../src/theme.js";

let doc: Document;
let store: Storage;

beforeEach(() => {
  const win = new Window();
  doc = win.document as unknown as Document;
  const btn = doc.createElement("button");
  btn.id = "theme-toggle";
  const label = doc.createElement("span");
  label.id = "theme-toggle-label";
  label.textContent = "自動";
  btn.appendChild(label);
  doc.body.appendChild(btn);

  // theme.ts reads the global localStorage, as it does in the browser.
  store = win.localStorage as unknown as Storage;
  store.clear();
  vi.stubGlobal("localStorage", store);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("nextMode", () => {
  it("cycles 自動 → ライト → ダーク → 自動", () => {
    expect(nextMode("auto")).toBe("light");
    expect(nextMode("light")).toBe("dark");
    expect(nextMode("dark")).toBe("auto");
  });
});

describe("applyMode", () => {
  it("follows the system preference in auto", () => {
    applyMode(doc, "auto", true);
    expect(doc.documentElement.dataset.theme).toBe("dark");
    applyMode(doc, "auto", false);
    expect(doc.documentElement.dataset.theme).toBe("light");
  });

  it("overrides the system preference when a mode is pinned", () => {
    applyMode(doc, "light", true);
    expect(doc.documentElement.dataset.theme).toBe("light");
    applyMode(doc, "dark", false);
    expect(doc.documentElement.dataset.theme).toBe("dark");
  });

  it("records the chosen mode separately from the resolved theme", () => {
    applyMode(doc, "auto", true);
    expect(doc.documentElement.dataset.themeMode).toBe("auto");
    expect(doc.documentElement.dataset.theme).toBe("dark");
  });

  it("labels the button with the current mode", () => {
    applyMode(doc, "light", false);
    expect(doc.getElementById("theme-toggle-label")?.textContent).toBe("ライト");
    applyMode(doc, "dark", false);
    expect(doc.getElementById("theme-toggle-label")?.textContent).toBe("ダーク");
  });

  it("gives the button an accessible name containing the visible label", () => {
    applyMode(doc, "dark", false);
    const name = doc.getElementById("theme-toggle")?.getAttribute("aria-label") ?? "";
    expect(name).toContain("ダーク");
    expect(name).toContain("切り替え");
  });
});

describe("readMode", () => {
  it("defaults to auto with nothing stored", () => {
    expect(readMode()).toBe("auto");
  });

  it("reads a stored preference", () => {
    store.setItem(THEME_STORAGE_KEY,"dark");
    expect(readMode()).toBe("dark");
  });

  it("falls back to auto on a junk value", () => {
    store.setItem(THEME_STORAGE_KEY,"neon");
    expect(readMode()).toBe("auto");
  });
});
