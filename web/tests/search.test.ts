import { describe, it, expect } from "vitest";
import { createSearcher } from "../src/search.js";
import type { Video } from "../src/types.js";

const v = (id: string, text: string, tags: string[] = []): Video => ({
  id,
  url: "",
  posted_at: "2026-04-01T00:00:00Z",
  duration_sec: 0,
  text,
  tags,
});

describe("createSearcher", () => {
  it("matches partial substrings", () => {
    const s = createSearcher([v("1", "ライブダイジェスト 渋谷"), v("2", "MV ティザー")]);
    expect(s.search("ダイジェスト").map((x) => x.id)).toEqual(["1"]);
  });

  it("returns all videos when query is empty", () => {
    const all = [v("1", "a"), v("2", "b")];
    const s = createSearcher(all);
    expect(s.search("").map((x) => x.id)).toEqual(["1", "2"]);
  });

  it("returns empty when nothing matches", () => {
    const s = createSearcher([v("1", "abc")]);
    expect(s.search("xyz")).toEqual([]);
  });

  it("matches against tags as well as text", () => {
    const s = createSearcher([
      v("1", "本文に手がかりは無い", ["live", "digest"]),
      v("2", "別の動画", ["mv"]),
    ]);
    expect(s.search("live").map((x) => x.id)).toEqual(["1"]);
    expect(s.search("mv").map((x) => x.id)).toEqual(["2"]);
  });
});
