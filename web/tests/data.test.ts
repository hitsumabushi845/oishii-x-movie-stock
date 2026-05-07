import { describe, it, expect } from "vitest";
import { parseVideosFile, sortVideos } from "../src/data.js";
import { parseGroupsManifest } from "../src/data.js";

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

describe("parseGroupsManifest", () => {
  const valid = {
    groups: [
      {
        slug: "aimai",
        display_name: "Aimai",
        x_handle: "official_aimai",
        data_file: "aimai.json",
        color: "#bc2956",
      },
      {
        slug: "shokuzai",
        display_name: "Shokuzai",
        x_handle: "ofc_shokuzai",
        data_file: "shokuzai.json",
        color: "#1A1A1A",
        color_dark: "#f7f9f9",
      },
    ],
  };

  it("converts snake_case to camelCase", () => {
    const m = parseGroupsManifest(valid);
    const g0 = m.groups[0]!;
    const g1 = m.groups[1]!;
    expect(g0.slug).toBe("aimai");
    expect(g0.displayName).toBe("Aimai");
    expect(g0.xHandle).toBe("official_aimai");
    expect(g0.dataFile).toBe("aimai.json");
    expect(g0.color).toBe("#bc2956");
    expect(g0.colorDark).toBeUndefined();
    expect(g1.colorDark).toBe("#f7f9f9");
  });

  it("rejects payloads with no groups", () => {
    expect(() => parseGroupsManifest({ groups: [] })).toThrow(/at least one group/);
  });

  it("rejects payloads with duplicate slugs", () => {
    const dup = { groups: [valid.groups[0], valid.groups[0]] };
    expect(() => parseGroupsManifest(dup)).toThrow(/duplicate/i);
  });

  it("rejects missing required fields", () => {
    const bad = { groups: [{ ...valid.groups[0], color: undefined }] };
    expect(() => parseGroupsManifest(bad)).toThrow();
  });
});
