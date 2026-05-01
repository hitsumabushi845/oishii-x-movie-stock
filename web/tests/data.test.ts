import { describe, it, expect } from "vitest";
import { parseVideosFile, sortVideos } from "../src/data.js";

describe("parseVideosFile", () => {
  it("returns the typed payload", () => {
    const raw = {
      generated_at: "2026-04-29T03:00:12Z",
      last_synced_at: "2026-04-28T11:23:45Z",
      source_query: "q",
      videos: [
        {
          id: "1",
          url: "u",
          posted_at: "2026-04-28T11:23:45Z",
          duration_sec: 1,
          text: "x",
          tags: [],
        },
      ],
    };
    const f = parseVideosFile(raw);
    expect(f.videos).toHaveLength(1);
    expect(f.videos[0]?.id).toBe("1");
  });

  it("throws on missing required field", () => {
    expect(() => parseVideosFile({ videos: [] })).toThrow();
  });
});

describe("sortVideos", () => {
  const a = {
    id: "a",
    url: "",
    posted_at: "2026-01-01T00:00:00Z",
    duration_sec: 0,
    text: "",
    tags: [],
  };
  const b = {
    id: "b",
    url: "",
    posted_at: "2026-02-01T00:00:00Z",
    duration_sec: 0,
    text: "",
    tags: [],
  };
  it("desc puts newest first", () => {
    expect(sortVideos([a, b], "desc").map((v) => v.id)).toEqual(["b", "a"]);
  });
  it("asc puts oldest first", () => {
    expect(sortVideos([a, b], "asc").map((v) => v.id)).toEqual(["a", "b"]);
  });
});
