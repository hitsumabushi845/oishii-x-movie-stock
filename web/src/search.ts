import Fuse from "fuse.js";
import type { Video } from "./types.js";

export type Searcher = {
  search(query: string): Video[];
};

export function createSearcher(videos: Video[]): Searcher {
  const fuse = new Fuse(videos, {
    keys: ["text"],
    threshold: 0.3,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
  return {
    search(query: string): Video[] {
      const q = query.trim();
      if (q.length === 0) return videos;
      return fuse.search(q).map((r) => r.item);
    },
  };
}
