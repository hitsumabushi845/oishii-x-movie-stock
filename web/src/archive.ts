import { loadVideosFile, sortVideos } from "./data.js";
import { archiveStats } from "./stats.js";
import type { Searcher } from "./search.js";
import type { SortOrder, VideosFile } from "./types.js";

/** Immutable, chronological views of one group; search is paid for on demand. */
export function createArchive(file: VideosFile) {
  const desc = sortVideos(file.videos, "desc");
  const asc = sortVideos(file.videos, "asc");
  let searcher: Promise<Searcher> | undefined;
  let lastQuery = "";
  let matches: Set<string> | undefined;

  return {
    generatedAt: file.generated_at,
    stats: archiveStats(desc),
    async select(query: string, minDuration: number, order: SortOrder) {
      const q = query.trim();
      let selected: Set<string> | undefined;
      if (q) {
        searcher ??= import("./search.js")
          .then(({ createSearcher }) => createSearcher(desc))
          .catch(error => { searcher = undefined; throw error; });
        const index = await searcher;
        if (q !== lastQuery) {
          matches = new Set(index.search(q).map(video => video.id));
          lastQuery = q;
        }
        selected = matches;
      }
      const sorted = order === "asc" ? asc : desc;
      if (!selected && minDuration <= 0) return sorted;
      return sorted.filter(video =>
        (!selected || selected.has(video.id)) && video.duration_sec >= minDuration,
      );
    },
  };
}

export type Archive = ReturnType<typeof createArchive>;

export function createGroupLoader(fetchFile = loadVideosFile) {
  const cache = new Map<string, Promise<Archive>>();
  return (url: string): Promise<Archive> => {
    let pending = cache.get(url);
    if (!pending) {
      pending = fetchFile(url).then(createArchive).catch(error => {
        cache.delete(url);
        throw error;
      });
      cache.set(url, pending);
    }
    return pending;
  };
}
