import type { Video } from "./types.js";

export type EmbedFn = (id: string, host: HTMLElement) => Promise<void> | void;
export type RenderDeps = { embed: EmbedFn };

/** Keep unchanged rows attached so typing does not reload a playing embed. */
export function replaceList(container: HTMLElement, videos: Video[], deps: RenderDeps): void {
  const wanted = new Set(videos.map(video => video.id));
  const existing = new Map<string, HTMLElement>();
  for (const row of Array.from(container.children) as HTMLElement[]) {
    if (row.dataset.id && wanted.has(row.dataset.id)) existing.set(row.dataset.id, row);
    else row.remove();
  }
  let cursor = container.firstElementChild;
  for (const video of videos) {
    const row = existing.get(video.id) ?? buildRow(video, deps);
    if (row !== cursor) container.insertBefore(row, cursor);
    cursor = row.nextElementSibling;
  }
}

export function renderList(container: HTMLElement, videos: Video[], deps: RenderDeps): void {
  const fragment = document.createDocumentFragment();
  for (const video of videos) fragment.appendChild(buildRow(video, deps));
  container.appendChild(fragment);
}

export const appendBatch = renderList;

function buildRow(video: Video, deps: RenderDeps): HTMLElement {
  const entry = document.createElement("article");
  entry.className = "entry";
  entry.dataset.id = video.id;

  const summary = document.createElement("button");
  summary.className = "entry__summary";
  summary.type = "button";
  summary.setAttribute("aria-expanded", "false");
  summary.setAttribute("aria-controls", `video-${video.id}`);

  const play = document.createElement("span");
  play.className = "entry__play";
  play.setAttribute("aria-hidden", "true");
  play.textContent = "▶";

  const content = document.createElement("span");
  content.className = "entry__content";
  const meta = document.createElement("span");
  meta.className = "entry__meta";
  const date = document.createElement("time");
  date.dateTime = video.posted_at;
  date.textContent = video.posted_at.slice(0, 10).replace(/-/g, ".");
  const time = document.createElement("span");
  time.className = "entry__time";
  time.textContent = formatDuration(video.duration_sec);
  meta.append(date, time);
  const text = document.createElement("span");
  text.className = "entry__text";
  text.textContent = video.text.replace(/\s+/g, " ").trim() || "動画の投稿";
  content.append(meta, text);

  const action = document.createElement("span");
  action.className = "entry__action";
  action.textContent = "動画を見る";
  summary.append(play, content, action);
  entry.appendChild(summary);

  let detail: HTMLElement | null = null;
  summary.addEventListener("click", async () => {
    if (detail) {
      detail.remove();
      detail = null;
      summary.setAttribute("aria-expanded", "false");
      entry.classList.remove("is-open");
      action.textContent = "動画を見る";
      return;
    }
    const panel = document.createElement("div");
    panel.id = `video-${video.id}`;
    panel.className = "entry__detail";
    detail = panel;
    const status = document.createElement("p");
    status.className = "embed-status";
    status.setAttribute("role", "status");
    status.textContent = "Xの投稿を読み込んでいます…";
    const link = document.createElement("a");
    // Accept X status links only; otherwise build a safe link from the status ID.
    link.href = /^https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+$/.test(video.url)
      ? video.url : `https://x.com/i/web/status/${encodeURIComponent(video.id)}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "entry__source";
    link.textContent = "Xで投稿を開く";
    const host = document.createElement("div");
    host.className = "embed-host";
    panel.append(link, status, host);
    entry.appendChild(panel);
    summary.setAttribute("aria-expanded", "true");
    entry.classList.add("is-open");
    action.textContent = "閉じる";
    try {
      await deps.embed(video.id, host);
      status.remove();
    } catch {
      if (detail !== panel) return;
      host.replaceChildren();
      status.textContent = "投稿を読み込めませんでした。Xで開くか、一度閉じてもう一度お試しください。";
    }
  });
  return entry;
}

function formatDuration(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}
