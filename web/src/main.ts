import { loadVideosFile, sortVideos } from "./data.js";
import { createSearcher } from "./search.js";
import { renderList, replaceList, appendBatch } from "./render.js";
import { embedTweet } from "./embed.js";
import { initTheme } from "./theme.js";
import type { SortOrder, Video } from "./types.js";

const BATCH = 20;
const DATA_URL = "./data/videos.json";

type State = {
  all: Video[];
  view: Video[];
  visible: number;
  order: SortOrder;
  query: string;
  minDurationSec: number;
};

const MIN_1M = 60;

async function bootstrap(): Promise<void> {
  initTheme();

  const list = document.getElementById("list") as HTMLElement;
  const sentinel = document.getElementById("sentinel") as HTMLElement;
  const countEl = document.getElementById("count") as HTMLElement;
  const updatedEl = document.getElementById("updated") as HTMLElement;
  const search = document.getElementById("q") as HTMLInputElement;
  const sortBtns = document.querySelectorAll<HTMLButtonElement>(".sort button");
  const min1m = document.getElementById("min-1m") as HTMLInputElement;

  const file = await loadVideosFile(DATA_URL);
  updatedEl.textContent = `最終更新: ${file.generated_at.replace("T", " ").replace("Z", " UTC")}`;

  const url = new URL(window.location.href);
  const initialQuery = url.searchParams.get("q") ?? "";
  const initialMin1m = url.searchParams.get("min1m") === "1";
  search.value = initialQuery;
  min1m.checked = initialMin1m;

  const searcher = createSearcher(file.videos);
  const state: State = {
    all: file.videos,
    view: [],
    visible: 0,
    order: "desc",
    query: initialQuery,
    minDurationSec: initialMin1m ? MIN_1M : 0,
  };

  function recompute(): void {
    const searched = state.query ? searcher.search(state.query) : state.all;
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

  search.addEventListener("input", () => {
    state.query = search.value;
    syncUrlParams(state);
    recompute();
  });

  for (const btn of sortBtns) {
    btn.addEventListener("click", () => {
      const order = btn.dataset.sort as SortOrder;
      state.order = order;
      sortBtns.forEach((b) => b.classList.toggle("active", b === btn));
      recompute();
    });
  }

  min1m.addEventListener("change", () => {
    state.minDurationSec = min1m.checked ? MIN_1M : 0;
    syncUrlParams(state);
    recompute();
  });

  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) appendNext();
  });
  io.observe(sentinel);

  recompute();
}

function syncUrlParams(state: State): void {
  const url = new URL(window.location.href);
  if (state.query) url.searchParams.set("q", state.query);
  else url.searchParams.delete("q");
  if (state.minDurationSec > 0) url.searchParams.set("min1m", "1");
  else url.searchParams.delete("min1m");
  window.history.replaceState(null, "", url.toString());
}

bootstrap().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML(
    "beforeend",
    `<pre style="color:red;padding:16px">${String(e)}</pre>`,
  );
});
