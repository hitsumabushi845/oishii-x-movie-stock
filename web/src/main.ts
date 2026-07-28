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
import { archiveStats, MIN_1M_RATIO, type ArchiveStats } from "./stats.js";
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
  const runtimeEl = document.getElementById("stat-runtime") as HTMLElement;
  const statCountEl = document.getElementById("stat-count") as HTMLElement;
  const statSpanEl = document.getElementById("stat-span") as HTMLElement;

  // Anchor the duration meter's 1-minute tick to the same scale render.ts uses.
  document.documentElement.style.setProperty(
    "--meter-tick",
    `${(MIN_1M_RATIO * 100).toFixed(2)}%`,
  );

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
      // Drop rejected promises so a transient fetch failure can be retried on the next click.
      pending.catch(() => groupCache.delete(slug));
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

  function paintArchiveStats(stats: ArchiveStats | null): void {
    runtimeEl.replaceChildren();
    if (!stats) {
      statCountEl.textContent = "";
      statSpanEl.textContent = "";
      return;
    }
    // 6時間15分 — digits in condensed mono, units in the display face.
    const parts: Array<[number, string]> = stats.hours
      ? [
          [stats.hours, "時間"],
          [stats.minutes, "分"],
        ]
      : [[stats.minutes, "分"]];
    for (const [value, unit] of parts) {
      const num = document.createElement("b");
      num.textContent = String(value);
      const label = document.createElement("span");
      label.textContent = unit;
      runtimeEl.append(num, label);
    }
    statCountEl.textContent = `${stats.count} CLIPS`;
    statSpanEl.textContent = `${stats.firstDate} → ${stats.lastDate}`;
  }

  async function recompute(): Promise<void> {
    const slug = state.activeGroup;
    const groupState = await loadGroup(slug);
    if (slug !== state.activeGroup) return;
    updatedEl.textContent = `最終更新 ${groupState.generatedAt
      .replace("T", " ")
      .replace("Z", " UTC")}`;
    // The masthead states the whole archive, not the current query.
    paintArchiveStats(archiveStats(groupState.videos));
    const searched = state.query
      ? groupState.searcher.search(state.query)
      : groupState.videos;
    const filtered =
      state.minDurationSec > 0
        ? searched.filter((v) => v.duration_sec >= state.minDurationSec)
        : searched;
    state.view = sortVideos(filtered, state.order);
    state.visible = Math.min(BATCH, state.view.length);
    countEl.textContent = `${state.view.length} 件`;
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
    try {
      await recompute();
    } catch (error) {
      showReloadError(error);
    }
  }

  // Initial chrome and tab render
  applyGroupChrome(state.activeGroup);
  buildTabs(tabsHost, state.manifest.groups, state.activeGroup, (slug) => {
    void selectGroup(slug, true);
  });

  search.addEventListener("input", () => {
    state.query = search.value;
    syncUrl(state, false);
    void recompute().catch(showReloadError);
  });

  for (const btn of sortBtns) {
    btn.addEventListener("click", () => {
      const order = btn.dataset.sort as SortOrder;
      state.order = order;
      sortBtns.forEach((b) => b.classList.toggle("active", b === btn));
      void recompute().catch(showReloadError);
    });
  }

  min1m.addEventListener("change", () => {
    state.minDurationSec = min1m.checked ? MIN_1M : 0;
    syncUrl(state, false);
    void recompute().catch(showReloadError);
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
    void recompute().catch(showReloadError);
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
  const defaultSlug = state.manifest.groups[0]!.slug;
  if (state.activeGroup && state.activeGroup !== defaultSlug) {
    url.searchParams.set("g", state.activeGroup);
  } else {
    url.searchParams.delete("g");
  }
  if (push) window.history.pushState(null, "", url.toString());
  else window.history.replaceState(null, "", url.toString());
}

bootstrap().catch((e) => {
  showReloadError(e);
});

function showReloadError(error: unknown): void {
  console.error(error);
  const main = document.createElement("main");
  main.className = "fatal-error";
  const heading = document.createElement("h1");
  heading.textContent = "データを読み込めませんでした";
  const message = document.createElement("p");
  message.textContent = "ページを再読み込みして、もう一度お試しください。";
  const reload = document.createElement("button");
  reload.type = "button";
  reload.textContent = "再読み込み";
  reload.addEventListener("click", () => window.location.reload());
  main.append(heading, message, reload);
  document.body.replaceChildren(main);
}
