import { resolveActiveGroup } from "./groups.js";
import type { GroupDef, SortOrder } from "./types.js";

export type ViewState = {
  activeGroup: string;
  query: string;
  minDurationSec: number;
  order: SortOrder;
};

export function readUrlState(url: URL, groups: GroupDef[]): ViewState {
  return {
    activeGroup: resolveActiveGroup(groups, url.searchParams.get("g")),
    query: url.searchParams.get("q") ?? "",
    minDurationSec: url.searchParams.get("min1m") === "1" ? 60 : 0,
    order: url.searchParams.get("sort") === "asc" ? "asc" : "desc",
  };
}

export function writeUrlState(url: URL, state: ViewState, defaultGroup: string): URL {
  const next = new URL(url);
  const params = {
    g: state.activeGroup === defaultGroup ? "" : state.activeGroup,
    q: state.query,
    min1m: state.minDurationSec > 0 ? "1" : "",
    sort: state.order === "asc" ? "asc" : "",
  };
  for (const [key, value] of Object.entries(params)) {
    if (value) next.searchParams.set(key, value);
    else next.searchParams.delete(key);
  }
  return next;
}
