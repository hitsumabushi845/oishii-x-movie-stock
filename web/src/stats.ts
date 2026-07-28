import type { Video } from "./types.js";

/**
 * Longest runtime the duration meter can express. Clips run 8s–833s but the
 * median is under a minute, so a linear scale would leave almost every bar
 * empty. METER_GAMMA compresses the long tail and gives short clips a readable
 * length.
 */
export const METER_CAP_SEC = 300;
const METER_GAMMA = 0.6;

/** The 1-minute mark, in meter-space — where the 「1分以上のみ」 filter cuts. */
export const MIN_1M_RATIO = meterRatio(60);

export function meterRatio(sec: number): number {
  const clamped = Math.min(Math.max(sec, 0), METER_CAP_SEC);
  return (clamped / METER_CAP_SEC) ** METER_GAMMA;
}

export type ArchiveStats = {
  count: number;
  hours: number;
  minutes: number;
  firstDate: string;
  lastDate: string;
};

export function archiveStats(videos: Video[]): ArchiveStats | null {
  if (videos.length === 0) return null;
  let totalSec = 0;
  let first = videos[0]!.posted_at;
  let last = videos[0]!.posted_at;
  for (const v of videos) {
    totalSec += v.duration_sec;
    if (v.posted_at < first) first = v.posted_at;
    if (v.posted_at > last) last = v.posted_at;
  }
  const totalMin = Math.round(totalSec / 60);
  return {
    count: videos.length,
    hours: Math.floor(totalMin / 60),
    minutes: totalMin % 60,
    firstDate: formatStatDate(first),
    lastDate: formatStatDate(last),
  };
}

/** 2026-07-07T13:25:01Z → 2026.07.07 */
export function formatStatDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, ".");
}
