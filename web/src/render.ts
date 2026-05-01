import type { Video } from "./types.js";

export type EmbedFn = (id: string, host: HTMLElement) => Promise<void> | void;

export type RenderDeps = {
  embed: EmbedFn;
};

export function replaceList(container: HTMLElement, videos: Video[], deps: RenderDeps): void {
  container.replaceChildren();
  renderList(container, videos, deps);
}

export function renderList(container: HTMLElement, videos: Video[], deps: RenderDeps): void {
  const frag = document.createDocumentFragment();
  for (const v of videos) {
    frag.appendChild(buildRow(v, deps));
  }
  container.appendChild(frag);
}

export function appendBatch(container: HTMLElement, videos: Video[], deps: RenderDeps): void {
  renderList(container, videos, deps);
}

function buildRow(video: Video, deps: RenderDeps): HTMLElement {
  const row = document.createElement("div");
  row.className = "row";
  row.dataset.id = video.id;

  const date = document.createElement("div");
  date.className = "date";
  date.textContent = formatDate(video.posted_at);

  const dur = document.createElement("div");
  dur.className = "dur";
  dur.textContent = formatDuration(video.duration_sec);

  const text = document.createElement("div");
  text.className = "text";
  text.textContent = video.text.replace(/\s+/g, " ").trim();

  const btn = document.createElement("button");
  btn.className = "play-btn";
  btn.type = "button";
  btn.textContent = "▶ 再生";

  let host: HTMLDivElement | null = null;
  btn.addEventListener("click", async () => {
    if (host) {
      host.remove();
      host = null;
      btn.textContent = "▶ 再生";
      btn.classList.remove("open");
      return;
    }
    host = document.createElement("div");
    host.className = "embed-host";
    row.appendChild(host);
    btn.textContent = "閉じる";
    btn.classList.add("open");
    await deps.embed(video.id, host);
  });

  row.appendChild(date);
  row.appendChild(dur);
  row.appendChild(text);
  row.appendChild(btn);
  return row;
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
