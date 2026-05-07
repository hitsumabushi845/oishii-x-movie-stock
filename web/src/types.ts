export type Video = {
  id: string;
  url: string;
  posted_at: string;
  duration_sec: number;
  text: string;
  tags: string[];
};

export type VideosFile = {
  generated_at: string;
  last_synced_at: string;
  source_query: string;
  videos: Video[];
};

export type SortOrder = "asc" | "desc";

export type GroupDef = {
  slug: string;
  displayName: string;
  xHandle: string;
  dataFile: string;
  color: string;
  colorDark?: string;
};

export type GroupsManifest = {
  groups: GroupDef[];
};
