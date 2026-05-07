import type { GroupDef } from "./types.js";

const STYLE_ID = "groups-theme-style";

export function resolveActiveGroup(
  groups: GroupDef[],
  requested: string | null,
): string {
  if (requested && groups.some((g) => g.slug === requested)) return requested;
  return groups[0]!.slug;
}

export function applyGroupTheme(
  doc: Document,
  groups: GroupDef[],
  activeSlug: string,
): void {
  doc.documentElement.dataset.group = activeSlug;
  ensureStyleTag(doc, groups);
}

function ensureStyleTag(doc: Document, groups: GroupDef[]): void {
  let el = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = doc.createElement("style");
    el.id = STYLE_ID;
    el.dataset.managed = "groups";
    doc.head.appendChild(el);
  }
  el.textContent = generateGroupCss(groups);
}

function generateGroupCss(groups: GroupDef[]): string {
  const lines: string[] = [];
  for (const g of groups) {
    // The site header inverts the palette (background: var(--fg); color: var(--bg)),
    // so a brand color calibrated for the page bg can match the header bg and become
    // invisible (e.g. shokuzai #1A1A1A on the dark header). For groups that opted into
    // colorDark, swap the two on the header so the accent always reads.
    const onHeaderLight = g.colorDark ?? g.color;
    lines.push(
      `:root[data-group="${g.slug}"] { --group-accent: ${g.color}; --group-accent-on-header: ${onHeaderLight}; }`,
    );
    if (g.colorDark) {
      lines.push(
        `[data-theme="dark"][data-group="${g.slug}"] { --group-accent: ${g.colorDark}; --group-accent-on-header: ${g.color}; }`,
      );
    }
  }
  return lines.join("\n");
}

export type TabSelectHandler = (slug: string) => void;

export function buildTabs(
  container: HTMLElement,
  groups: GroupDef[],
  activeSlug: string,
  onSelect: TabSelectHandler,
): void {
  container.replaceChildren();
  for (const g of groups) {
    const btn = container.ownerDocument.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "tab");
    btn.dataset.group = g.slug;
    btn.textContent = g.displayName;
    const active = g.slug === activeSlug;
    btn.setAttribute("aria-selected", active ? "true" : "false");
    btn.setAttribute("tabindex", active ? "0" : "-1");
    btn.addEventListener("click", () => onSelect(g.slug));
    container.appendChild(btn);
  }
}

export function updateHeaderForGroup(
  doc: Document,
  group: GroupDef,
): void {
  const sub = doc.getElementById("site-sub");
  if (sub) sub.textContent = `@${group.xHandle} の動画アーカイブ`;
  const link = doc.getElementById("site-link");
  if (link) link.setAttribute("href", `https://x.com/${group.xHandle}`);
}
