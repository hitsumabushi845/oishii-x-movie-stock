import type { Video, VideosFile, SortOrder } from "./types.js";

export async function loadVideosFile(url: string): Promise<VideosFile> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to fetch ${url}: ${res.status}`);
  return parseVideosFile(await res.json());
}

export function parseVideosFile(raw: unknown): VideosFile {
  if (!raw || typeof raw !== "object") throw new Error("invalid payload");
  const r = raw as Record<string, unknown>;
  const required = ["generated_at", "last_synced_at", "source_query", "videos"] as const;
  for (const k of required) {
    if (!(k in r)) throw new Error(`missing field: ${k}`);
  }
  if (!Array.isArray(r.videos)) throw new Error("videos must be array");
  const videos = r.videos.map((v) => parseVideo(v));
  return {
    generated_at: String(r.generated_at),
    last_synced_at: String(r.last_synced_at),
    source_query: String(r.source_query),
    videos,
  };
}

function parseVideo(raw: unknown): Video {
  if (!raw || typeof raw !== "object") throw new Error("invalid video");
  const r = raw as Record<string, unknown>;
  const required = ["id", "url", "posted_at", "duration_sec", "text", "tags"] as const;
  for (const k of required) {
    if (!(k in r)) throw new Error(`video missing field: ${k}`);
  }
  return {
    id: String(r.id),
    url: String(r.url),
    posted_at: String(r.posted_at),
    duration_sec: Number(r.duration_sec),
    text: String(r.text),
    tags: (r.tags as unknown[]).map((t) => String(t)),
  };
}

export function sortVideos(videos: Video[], order: SortOrder): Video[] {
  const copy = videos.slice();
  copy.sort((a, b) => {
    const cmp = a.posted_at.localeCompare(b.posted_at);
    return order === "desc" ? -cmp : cmp;
  });
  return copy;
}
