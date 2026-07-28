import { describe, it, expect } from "vitest";
import { archiveStats, meterRatio, MIN_1M_RATIO, METER_CAP_SEC } from "../src/stats.js";
import type { Video } from "../src/types.js";

const v = (posted: string, duration: number): Video => ({
  id: posted,
  url: "u",
  posted_at: posted,
  duration_sec: duration,
  text: "t",
  tags: [],
});

describe("meterRatio", () => {
  it("is 0 at zero and 1 at the cap", () => {
    expect(meterRatio(0)).toBe(0);
    expect(meterRatio(METER_CAP_SEC)).toBe(1);
  });

  it("clamps clips longer than the cap", () => {
    expect(meterRatio(METER_CAP_SEC * 3)).toBe(1);
  });

  it("increases monotonically", () => {
    expect(meterRatio(30)).toBeLessThan(meterRatio(60));
    expect(meterRatio(60)).toBeLessThan(meterRatio(240));
  });

  it("gives sub-minute clips a visible length despite the long tail", () => {
    // A linear scale would put a 30s clip at 10%; the gamma curve lifts it.
    expect(meterRatio(30)).toBeGreaterThan(0.2);
  });

  it("exports the 1-minute tick position on the same scale", () => {
    expect(MIN_1M_RATIO).toBe(meterRatio(60));
  });
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
