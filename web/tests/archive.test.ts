import { describe, it, expect, vi } from "vitest";
import { createArchive, createGroupLoader } from "../src/archive.js";
import type { Video, VideosFile } from "../src/types.js";

const videos: Video[] = [
  { id: "1", url: "u", posted_at: "2026-01-01T00:00:00Z", duration_sec: 30, text: "ライブ 東京", tags: [] },
  { id: "2", url: "u", posted_at: "2026-03-01T00:00:00Z", duration_sec: 90, text: "ライブ 大阪", tags: [] },
  { id: "3", url: "u", posted_at: "2026-02-01T00:00:00Z", duration_sec: 60, text: "東京", tags: ["ライブ"] },
];
const file: VideosFile = { videos, generated_at: "2026-03-01T00:00:00Z", last_synced_at: "2026-03-01T00:00:00Z", source_query: "q" };

describe("archive", () => {
  it("combines fuzzy search, duration and chronological order without changing source data", async () => {
    const archive = createArchive(file);
    expect((await archive.select("ライブ", 60, "desc")).map(v => v.id)).toEqual(["2", "3"]);
    expect((await archive.select("ライブ", 60, "asc")).map(v => v.id)).toEqual(["3", "2"]);
    expect((await archive.select("  ", 0, "desc")).map(v => v.id)).toEqual(["2", "3", "1"]);
    expect(videos.map(v => v.id)).toEqual(["1", "2", "3"]);
    expect(archive.stats?.count).toBe(3);
  });
  it("shares concurrent loads and lets a failed group be retried", async () => {
    const fetchFile = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(file);
    const load = createGroupLoader(fetchFile);
    const one = load("a.json");
    const two = load("a.json");
    expect(one).toBe(two);
    await expect(one).rejects.toThrow("offline");
    const archive = await load("a.json");
    expect((await archive.select("", 0, "desc"))).toHaveLength(3);
    expect(fetchFile).toHaveBeenCalledTimes(2);
    expect(await load("a.json")).toBe(archive);
  });
});
