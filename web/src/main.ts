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
};

async function bootstrap(): Promise<void> {
  initTheme();

  const list = document.getElementById("list") as HTMLElement;
  const sentinel = document.getElementById("sentinel") as HTMLElement;
  const countEl = document.getElementById("count") as HTMLElement;
  const updatedEl = document.getElementById("updated") as HTMLElement;
  const search = document.getElementById("q") as HTMLInputElement;
  const sortBtns = document.querySelectorAll<HTMLButtonElement>(".sort button");

  const file = await loadVideosFile(DATA_URL);
  updatedEl.textContent = `最終更新: ${file.generated_at.replace("T", " ").replace("Z", " UTC")}`;

  const initialQuery = new URL(window.location.href).searchParams.get("q") ?? "";
  search.value = initialQuery;

  const searcher = createSearcher(file.videos);
  const state: State = {
    all: file.videos,
    view: [],
    visible: 0,
    order: "desc",
    query: initialQuery,
  };

  function recompute(): void {
    const filtered = state.query ? searcher.search(state.query) : state.all;
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
    syncQueryParam(state.query);
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

  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) appendNext();
  });
  io.observe(sentinel);

  recompute();
}

function syncQueryParam(q: string): void {
  const url = new URL(window.location.href);
  if (q) url.searchParams.set("q", q);
  else url.searchParams.delete("q");
  window.history.replaceState(null, "", url.toString());
}

bootstrap().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML(
    "beforeend",
    `<pre style="color:red;padding:16px">${String(e)}</pre>`,
  );
});
