import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { VideosFile } from "../src/types.js";
import { initApp } from "../src/app.js";

const manifest = { groups: [
  { slug: "aimai", display_name: "美味しい曖昧", x_handle: "official_aimai", data_file: "aimai.json", color: "#bc2956" },
  { slug: "mizutama", display_name: "美味しい水玉", x_handle: "oishii_mizutama", data_file: "mizutama.json", color: "#6CAAEF" },
] };
const file: VideosFile = { generated_at: "2026-01-01T00:00:00Z", last_synced_at: "2026-01-01T00:00:00Z", source_query: "q", videos: [
  { id: "1", url: "https://x.com/a/status/1", posted_at: "2026-01-01T00:00:00Z", duration_sec: 30, text: "東京 ライブ", tags: [] },
  { id: "2", url: "https://x.com/a/status/2", posted_at: "2026-02-01T00:00:00Z", duration_sec: 90, text: "大阪 ライブ", tags: [] },
] };
let dispose: (() => void) | undefined;
let fetchMock: ReturnType<typeof vi.fn>;
const click = (selector: string) => document.querySelector<HTMLButtonElement>(selector)!.click();
const ids = () => Array.from(document.querySelectorAll<HTMLElement>(".entry")).map(e => e.dataset.id);

beforeEach(() => {
  document.body.innerHTML = readFileSync("index.html", "utf8").split("<body>")[1]!.split("</body>")[0]!.replace(/<script[\s\S]*?<\/script>/g, "");
  window.history.replaceState(null, "", "/");
  fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith("groups.json") ? manifest : file }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });

it("loads sort/filter from URL and restores them through browser history", async () => {
  window.history.replaceState(null, "", "/?sort=asc&min1m=1");
  dispose = await initApp();
  expect(ids()).toEqual(["2"]);
  expect(document.querySelector('[data-sort="asc"]')?.getAttribute("aria-pressed")).toBe("true");
  window.history.replaceState(null, "", "/?sort=asc");
  window.dispatchEvent(new PopStateEvent("popstate"));
  await vi.waitFor(() => expect(ids()).toEqual(["1", "2"]));
});

it("ignores a late failure from a group the user already left", async () => {
  dispose = await initApp();
  let reject!: (error: Error) => void;
  fetchMock.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  click('[data-group="mizutama"]');
  expect(ids()).toEqual([]);
  click('[data-group="aimai"]');
  await vi.waitFor(() => expect(ids()).toEqual(["2", "1"]));
  reject(new Error("offline"));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(document.querySelector("#site-sub")?.textContent).toBe("美味しい曖昧");
  expect(ids()).toEqual(["2", "1"]);
  expect(document.querySelector("#status")?.textContent).not.toContain("読み込めません");
});

it("recovers a failed group in place without losing navigation", async () => {
  dispose = await initApp();
  fetchMock.mockRejectedValueOnce(new Error("offline"));
  click('[data-group="mizutama"]');
  await vi.waitFor(() => expect(document.querySelector("#status")?.textContent).toContain("読み込めません"));
  expect(document.querySelectorAll("#tabs button")).toHaveLength(2);
  click("#status button");
  await vi.waitFor(() => expect(ids()).toEqual(["2", "1"]));
});

it("waits until Japanese composition finishes before replacing results", async () => {
  dispose = await initApp();
  const search = document.querySelector<HTMLInputElement>("#q")!;
  search.dispatchEvent(new CompositionEvent("compositionstart"));
  search.value = "東京";
  search.dispatchEvent(new InputEvent("input", { isComposing: true }));
  await new Promise(resolve => setTimeout(resolve, 180));
  expect(ids()).toEqual(["2", "1"]);
  search.dispatchEvent(new CompositionEvent("compositionend"));
  await vi.waitFor(() => expect(ids()).toEqual(["1"]));
  expect(new URL(window.location.href).searchParams.get("q")).toBe("東京");
});

it("supports paging all results when IntersectionObserver is unavailable", async () => {
  vi.stubGlobal("IntersectionObserver", undefined);
  const many = { ...file, videos: Array.from({ length: 45 }, (_, i) => ({ ...file.videos[0]!, id: String(i + 1) })) };
  fetchMock.mockImplementation(async (url: string) => ({ ok: true, json: async () => url.endsWith("groups.json") ? manifest : many }));
  dispose = await initApp();
  expect(ids()).toHaveLength(20);
  click("#load-more");
  expect(ids()).toHaveLength(40);
  click("#load-more");
  expect(ids()).toHaveLength(45);
  expect(new Set(ids()).size).toBe(45);
  expect(document.querySelector<HTMLElement>("#sentinel")!.hidden).toBe(true);
});

it("appends the next batch as the sentinel enters view", async () => {
  let intersect!: (entries: { isIntersecting: boolean }[]) => void;
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: typeof intersect) { intersect = callback; }
    observe() {} unobserve() {} disconnect() {}
  });
  const many = { ...file, videos: Array.from({ length: 41 }, (_, i) => ({ ...file.videos[0]!, id: String(i + 1) })) };
  fetchMock.mockImplementation(async (url: string) => ({ ok: true, json: async () => url.endsWith("groups.json") ? manifest : many }));
  dispose = await initApp();
  intersect([{ isIntersecting: false }]);
  expect(ids()).toHaveLength(20);
  intersect([{ isIntersecting: true }]);
  expect(ids()).toHaveLength(40);
  intersect([{ isIntersecting: true }]);
  expect(ids()).toHaveLength(41);
  intersect([{ isIntersecting: true }]);
  expect(ids()).toHaveLength(41);
});
