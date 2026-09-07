import { loadGroupsManifest } from "./data.js";
import { createGroupLoader, type Archive } from "./archive.js";
import { replaceList, appendBatch } from "./render.js";
import { embedTweet } from "./embed.js";
import { applyGroupTheme, buildTabs, updateHeaderForGroup, updateTabs } from "./groups.js";
import { readUrlState, writeUrlState } from "./url-state.js";
import type { SortOrder, Video } from "./types.js";

const BATCH = 20;

export async function initApp(): Promise<() => void> {
  const list = document.getElementById("list")!;
  const sentinel = document.getElementById("sentinel")!;
  const more = document.getElementById("load-more") as HTMLButtonElement;
  const status = document.getElementById("status")!;
  const count = document.getElementById("count")!;
  const search = document.getElementById("q") as HTMLInputElement;
  const min1m = document.getElementById("min-1m") as HTMLInputElement;
  const sortButtons = document.querySelectorAll<HTMLButtonElement>(".sort button");
  const tabs = document.getElementById("tabs")!;
  const manifest = await loadGroupsManifest("./data/groups.json");
  const groups = new Map(manifest.groups.map(group => [group.slug, group]));
  const loadGroup = createGroupLoader();
  const events = new AbortController();
  const eventOptions = { signal: events.signal };
  let state = readUrlState(new URL(window.location.href), manifest.groups);
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let composing = false;
  let view: Video[] = [];
  let visible = 0;
  let ready = false;
  let displayedGroup = "";
  let paintedArchive: Archive | undefined;

  function syncUrl(push = false): void {
    const url = writeUrlState(new URL(window.location.href), state, manifest.groups[0]!.slug);
    if (url.href === window.location.href) return;
    if (push) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }

  function paintControls(): void {
    search.value = state.query;
    min1m.checked = state.minDurationSec > 0;
    for (const button of sortButtons) {
      const active = button.dataset.sort === state.order;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    applyGroupTheme(document, manifest.groups, state.activeGroup);
    updateHeaderForGroup(document, groups.get(state.activeGroup)!);
    updateTabs(tabs, state.activeGroup);
  }

  function paintStats(archive?: Archive): void {
    if (archive && archive === paintedArchive) return;
    paintedArchive = archive;
    const stats = archive?.stats;
    document.getElementById("stat-count")!.textContent = stats ? `${stats.count}本の動画` : "";
    document.getElementById("stat-runtime")!.textContent = stats
      ? `合計 ${stats.hours ? `${stats.hours}時間` : ""}${stats.minutes}分` : "";
    document.getElementById("stat-span")!.textContent = stats ? `${stats.firstDate} 〜 ${stats.lastDate}` : "";
    document.getElementById("updated")!.textContent = archive
      ? `データ更新 ${archive.generatedAt.slice(0, 10).replace(/-/g, ".")}` : "";
  }

  function showStatus(message: string, action?: [string, () => void]): void {
    status.replaceChildren();
    status.hidden = !message;
    if (!message) return;
    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    status.appendChild(paragraph);
    if (action) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action[0];
      button.addEventListener("click", action[1], eventOptions);
      status.appendChild(button);
    }
  }

  function paintPagination(): void {
    const remaining = view.length - visible;
    sentinel.hidden = remaining <= 0;
    more.textContent = `さらに${Math.min(BATCH, remaining)}件を表示`;
    // Re-arm after a result change, including when the sentinel remains in view.
    observer?.unobserve(sentinel);
    if (remaining > 0) observer?.observe(sentinel);
  }

  async function recompute(): Promise<void> {
    clearTimeout(timer);
    const current = ++generation;
    const request = { ...state };
    ready = false;
    sentinel.hidden = true;
    list.setAttribute("aria-busy", "true");
    if (displayedGroup !== request.activeGroup) {
      list.replaceChildren();
      count.textContent = "";
      paintStats();
      displayedGroup = request.activeGroup;
      showStatus("動画を読み込んでいます…");
    }
    try {
      const group = groups.get(request.activeGroup)!;
      const archive = await loadGroup(`./data/${group.dataFile}`);
      if (current !== generation) return;
      const next = await archive.select(request.query, request.minDurationSec, request.order);
      if (current !== generation) return;
      view = next;
      visible = Math.min(BATCH, view.length);
      ready = true;
      paintStats(archive);
      count.textContent = `${view.length}件`;
      replaceList(list, view.slice(0, visible), { embed: embedTweet });
      if (view.length) showStatus("");
      else if (request.query || request.minDurationSec) {
        showStatus("条件に合う動画がありません。検索語や動画の長さを変えてみてください。", ["絞り込みを解除", () => {
          state.query = "";
          state.minDurationSec = 0;
          paintControls();
          syncUrl();
          void recompute();
        }]);
      } else showStatus("このグループの動画はまだ登録されていません。");
      paintPagination();
    } catch {
      if (current !== generation) return;
      count.textContent = "";
      showStatus("動画を読み込めませんでした。接続を確認して、もう一度お試しください。", ["もう一度読み込む", () => { void recompute(); }]);
    } finally {
      if (current === generation) list.setAttribute("aria-busy", "false");
    }
  }

  function appendNext(): void {
    if (!ready || visible >= view.length) return;
    const next = view.slice(visible, visible + BATCH);
    visible += next.length;
    appendBatch(list, next, { embed: embedTweet });
    paintPagination();
  }
  const observer = typeof IntersectionObserver === "undefined" ? undefined : new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) appendNext();
  }, { rootMargin: "240px" });

  buildTabs(tabs, manifest.groups, state.activeGroup, slug => {
    if (slug === state.activeGroup) return;
    state.activeGroup = slug;
    paintControls();
    syncUrl(true);
    void recompute();
  });
  paintControls();

  function scheduleSearch(): void {
    state.query = search.value;
    syncUrl();
    ++generation; // Invalidate a pending load immediately, before the debounce expires.
    ready = false;
    clearTimeout(timer);
    timer = setTimeout(() => { void recompute(); }, 150);
  }
  search.addEventListener("compositionstart", () => { composing = true; clearTimeout(timer); }, eventOptions);
  search.addEventListener("compositionend", () => { composing = false; scheduleSearch(); }, eventOptions);
  search.addEventListener("input", () => { if (!composing) scheduleSearch(); }, eventOptions);
  min1m.addEventListener("change", () => {
    state.minDurationSec = min1m.checked ? 60 : 0;
    syncUrl();
    void recompute();
  }, eventOptions);
  for (const button of sortButtons) {
    button.addEventListener("click", () => {
      state.order = button.dataset.sort as SortOrder;
      paintControls();
      syncUrl();
      void recompute();
    }, eventOptions);
  }
  more.addEventListener("click", appendNext, eventOptions);
  window.addEventListener("popstate", () => {
    state = readUrlState(new URL(window.location.href), manifest.groups);
    paintControls();
    void recompute();
  }, eventOptions);
  await recompute();
  return () => {
    ++generation;
    clearTimeout(timer);
    events.abort();
    observer?.disconnect();
  };
}
