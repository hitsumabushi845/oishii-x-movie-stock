import type { Video, VideosFile, SortOrder, GroupDef, GroupsManifest } from "./types.js";

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
  if (new Set(videos.map(video => video.id)).size !== videos.length) {
    throw new Error("duplicate video id");
  }
  return {
    generated_at: timestamp(r.generated_at, "generated_at"),
    last_synced_at: timestamp(r.last_synced_at, "last_synced_at"),
    source_query: stringField(r.source_query, "source_query"),
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
  if (typeof r.duration_sec !== "number" || !Number.isInteger(r.duration_sec) || r.duration_sec < 0) {
    throw new Error("invalid duration_sec");
  }
  if (!Array.isArray(r.tags) || !r.tags.every(tag => typeof tag === "string")) {
    throw new Error("invalid tags");
  }
  const id = stringField(r.id, "id");
  if (!/^\d+$/.test(id)) throw new Error("invalid video id");
  return {
    id,
    url: stringField(r.url, "url"),
    posted_at: timestamp(r.posted_at, "posted_at"),
    duration_sec: r.duration_sec,
    text: stringField(r.text, "text"),
    tags: r.tags,
  };
}

function stringField(value: unknown, name: string): string {
  if (typeof value !== "string") throw new Error(`invalid ${name}`);
  return value;
}

function timestamp(value: unknown, name: string): string {
  const text = stringField(value, name);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(text) || !Number.isFinite(Date.parse(text))) {
    throw new Error(`invalid ${name}`);
  }
  // One timezone and precision make chronological string sorting reliable.
  return new Date(text).toISOString();
}

export function sortVideos(videos: Video[], order: SortOrder): Video[] {
  const copy = videos.slice();
  copy.sort((a, b) => {
    const cmp = a.posted_at.localeCompare(b.posted_at);
    return order === "desc" ? -cmp : cmp;
  });
  return copy;
}

export async function loadGroupsManifest(url: string): Promise<GroupsManifest> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to fetch ${url}: ${res.status}`);
  return parseGroupsManifest(await res.json());
}

export function parseGroupsManifest(raw: unknown): GroupsManifest {
  if (!raw || typeof raw !== "object") throw new Error("invalid manifest payload");
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.groups)) throw new Error("groups must be array");
  if (r.groups.length === 0) throw new Error("manifest must contain at least one group");
  const seen = new Set<string>();
  const groups: GroupDef[] = r.groups.map((g) => {
    const def = parseGroupDef(g);
    if (seen.has(def.slug)) throw new Error(`duplicate group slug: ${def.slug}`);
    seen.add(def.slug);
    return def;
  });
  return { groups };
}

function parseGroupDef(raw: unknown): GroupDef {
  if (!raw || typeof raw !== "object") throw new Error("invalid group");
  const r = raw as Record<string, unknown>;
  const required = ["slug", "display_name", "x_handle", "data_file", "color"] as const;
  for (const k of required) {
    if (typeof r[k] !== "string" || (r[k] as string).length === 0) {
      throw new Error(`group missing required field: ${k}`);
    }
  }
  const patterns = {
    slug: /^[a-z][a-z0-9_-]*$/,
    x_handle: /^[A-Za-z0-9_]{1,15}$/,
    data_file: /^[A-Za-z0-9_.-]+\.json$/,
    color: /^#[0-9a-f]{6}$/i,
    color_dark: /^#[0-9a-f]{6}$/i,
  };
  for (const [key, pattern] of Object.entries(patterns)) {
    if (key === "color_dark" && r[key] === undefined) continue;
    if (typeof r[key] !== "string" || !pattern.test(r[key])) throw new Error(`invalid group ${key}`);
  }
  const def: GroupDef = {
    slug: String(r.slug),
    displayName: String(r.display_name),
    xHandle: String(r.x_handle),
    dataFile: String(r.data_file),
    color: String(r.color),
  };
  if (r.color_dark !== undefined) def.colorDark = String(r.color_dark);
  return def;
}
