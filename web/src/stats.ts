import type { Video } from "./types.js";

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
