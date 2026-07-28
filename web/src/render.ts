import type { Video } from "./types.js";
import { meterRatio } from "./stats.js";

export type EmbedFn = (id: string, host: HTMLElement) => Promise<void> | void;

export type RenderDeps = {
  embed: EmbedFn;
};

const STAGGER_MS = 22;
const STAGGER_MAX = 10;

export function replaceList(container: HTMLElement, videos: Video[], deps: RenderDeps): void {
  container.replaceChildren();
  renderList(container, videos, deps);
}

export function renderList(container: HTMLElement, videos: Video[], deps: RenderDeps): void {
  const frag = document.createDocumentFragment();
  videos.forEach((v, i) => {
    frag.appendChild(buildRow(v, deps, i));
  });
  container.appendChild(frag);
}

export function appendBatch(container: HTMLElement, videos: Video[], deps: RenderDeps): void {
  renderList(container, videos, deps);
}

function buildRow(video: Video, deps: RenderDeps, index: number): HTMLElement {
  const doc = document;
  const entry = doc.createElement("article");
  entry.className = "entry";
  entry.dataset.id = video.id;
  entry.style.setProperty("--stagger", `${Math.min(index, STAGGER_MAX) * STAGGER_MS}ms`);

  const summary = doc.createElement("button");
  summary.className = "entry__summary";
  summary.type = "button";
  summary.setAttribute("aria-expanded", "false");

  const date = doc.createElement("span");
  date.className = "entry__date";
  const year = doc.createElement("span");
  year.className = "entry__year";
  year.textContent = video.posted_at.slice(0, 4);
  const day = doc.createElement("span");
  day.className = "entry__day";
  day.textContent = video.posted_at.slice(5, 10).replace("-", ".");
  date.append(year, day);

  const meter = doc.createElement("span");
  meter.className = "entry__meter";
  const time = doc.createElement("span");
  time.className = "entry__time";
  time.textContent = formatDuration(video.duration_sec);
  const track = doc.createElement("span");
  track.className = "meter";
  const fill = doc.createElement("span");
  fill.className = "meter__fill";
  fill.style.setProperty("--fill", `${(meterRatio(video.duration_sec) * 100).toFixed(1)}%`);
  track.appendChild(fill);
  meter.append(time, track);

  const text = doc.createElement("span");
  text.className = "entry__text";
  text.textContent = video.text.replace(/\s+/g, " ").trim();

  const caret = doc.createElement("span");
  caret.className = "entry__caret";
  caret.setAttribute("aria-hidden", "true");
  caret.textContent = "▶";

  summary.append(date, meter, text, caret);
  entry.appendChild(summary);

  let host: HTMLDivElement | null = null;
  summary.addEventListener("click", async () => {
    if (host) {
      host.remove();
      host = null;
      summary.setAttribute("aria-expanded", "false");
      entry.classList.remove("is-open");
      return;
    }
    host = doc.createElement("div");
    host.className = "embed-host";
    entry.appendChild(host);
    summary.setAttribute("aria-expanded", "true");
    entry.classList.add("is-open");
    await deps.embed(video.id, host);
  });

  return entry;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
