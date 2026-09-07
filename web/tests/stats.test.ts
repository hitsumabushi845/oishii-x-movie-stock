import { describe, it, expect } from "vitest";
import { archiveStats } from "../src/stats.js";
import type { Video } from "../src/types.js";

const v = (posted: string, duration: number): Video => ({
  id: posted,
  url: "u",
  posted_at: posted,
  duration_sec: duration,
  text: "t",
  tags: [],
});

describe("archiveStats", () => {
  it("returns null for an empty archive", () => {
    expect(archiveStats([])).toBeNull();
  });

  it("totals runtime into hours and minutes", () => {
    const stats = archiveStats([v("2025-01-01T00:00:00Z", 3600), v("2025-01-02T00:00:00Z", 900)]);
    expect(stats).toMatchObject({ count: 2, hours: 1, minutes: 15 });
  });

  it("omits hours when the archive is under an hour", () => {
    const stats = archiveStats([v("2025-01-01T00:00:00Z", 1080)]);
    expect(stats).toMatchObject({ hours: 0, minutes: 18 });
  });

  it("spans the earliest and latest post regardless of input order", () => {
    const stats = archiveStats([
      v("2026-07-07T13:25:01Z", 10),
      v("2020-10-31T09:00:00Z", 10),
      v("2024-03-12T09:00:00Z", 10),
    ]);
    expect(stats?.firstDate).toBe("2020.10.31");
    expect(stats?.lastDate).toBe("2026.07.07");
  });
});
