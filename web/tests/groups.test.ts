import { describe, it, expect, beforeEach } from "vitest";
import { Window } from "happy-dom";
import {
  applyGroupTheme,
  buildTabs,
  resolveActiveGroup,
} from "../src/groups.js";
import type { GroupDef } from "../src/types.js";

const GROUPS: GroupDef[] = [
  { slug: "aimai", displayName: "美味しい曖昧", xHandle: "official_aimai",
    dataFile: "aimai.json", color: "#bc2956" },
  { slug: "shokuzai", displayName: "美味しい贖罪", xHandle: "ofc_shokuzai",
    dataFile: "shokuzai.json", color: "#1A1A1A", colorDark: "#f7f9f9" },
  { slug: "mizutama", displayName: "美味しい水玉", xHandle: "oishii_mizutama",
    dataFile: "mizutama.json", color: "#6CAAEF" },
];

let win: Window;
let doc: Document;

beforeEach(() => {
  win = new Window();
  doc = win.document as unknown as Document;
  // emulate <html> being available
  doc.documentElement.setAttribute("data-theme", "light");
});

describe("resolveActiveGroup", () => {
  it("returns the requested slug when valid", () => {
    expect(resolveActiveGroup(GROUPS, "shokuzai")).toBe("shokuzai");
  });
  it("falls back to the first group when slug is invalid", () => {
    expect(resolveActiveGroup(GROUPS, "ghost")).toBe("aimai");
  });
  it("falls back to the first group when slug is null", () => {
    expect(resolveActiveGroup(GROUPS, null)).toBe("aimai");
  });
});

describe("applyGroupTheme", () => {
  it("sets data-group on documentElement", () => {
    applyGroupTheme(doc as unknown as Document, GROUPS, "mizutama");
    expect(doc.documentElement.getAttribute("data-group")).toBe("mizutama");
  });
  it("injects per-group CSS custom properties (idempotent)", () => {
    applyGroupTheme(doc as unknown as Document, GROUPS, "mizutama");
    applyGroupTheme(doc as unknown as Document, GROUPS, "mizutama");
    const styles = doc.querySelectorAll('style[data-managed="groups"]');
    expect(styles.length).toBe(1);
    const css = styles[0]!.textContent ?? "";
    expect(css).toContain('[data-group="aimai"]');
    expect(css).toContain("#bc2956");
    expect(css).toContain('[data-group="shokuzai"]');
    expect(css).toContain('[data-theme="dark"][data-group="shokuzai"]');
    expect(css).toContain("#f7f9f9");
  });
  it("inverts on-header accent for groups with colorDark so it reads on the inverted header", () => {
    applyGroupTheme(doc as unknown as Document, GROUPS, "shokuzai");
    const css = doc.querySelector('style[data-managed="groups"]')!.textContent ?? "";
    expect(css).toMatch(
      /:root\[data-group="shokuzai"\][^}]*--group-accent-on-header:\s*#f7f9f9/,
    );
    expect(css).toMatch(
      /\[data-theme="dark"\]\[data-group="shokuzai"\][^}]*--group-accent-on-header:\s*#1A1A1A/,
    );
  });
  it("uses plain color for on-header accent when no colorDark is provided", () => {
    applyGroupTheme(doc as unknown as Document, GROUPS, "aimai");
    const css = doc.querySelector('style[data-managed="groups"]')!.textContent ?? "";
    expect(css).toMatch(
      /:root\[data-group="aimai"\][^}]*--group-accent-on-header:\s*#bc2956/,
    );
  });
});

describe("buildTabs", () => {
  it("renders one button per group with aria-selected reflecting active", () => {
    const nav = doc.createElement("nav");
    buildTabs(nav as unknown as HTMLElement, GROUPS, "shokuzai", () => {});
    const buttons = nav.querySelectorAll("button[role='tab']");
    expect(buttons.length).toBe(3);
    expect((buttons[0]! as HTMLButtonElement).getAttribute("aria-selected")).toBe("false");
    expect((buttons[1]! as HTMLButtonElement).getAttribute("aria-selected")).toBe("true");
    expect((buttons[1]! as HTMLButtonElement).getAttribute("data-group")).toBe("shokuzai");
    expect((buttons[2]! as HTMLButtonElement).getAttribute("tabindex")).toBe("-1");
    expect((buttons[1]! as HTMLButtonElement).getAttribute("tabindex")).toBe("0");
  });

  it("invokes onSelect with the slug when a tab is clicked", () => {
    const nav = doc.createElement("nav");
    let last: string | null = null;
    buildTabs(nav as unknown as HTMLElement, GROUPS, "aimai", (slug) => {
      last = slug;
    });
    const target = nav.querySelectorAll("button[role='tab']")[2]! as HTMLButtonElement;
    target.click();
    expect(last).toBe("mizutama");
  });

  it("re-render updates aria-selected and replaces previous buttons", () => {
    const nav = doc.createElement("nav");
    buildTabs(nav as unknown as HTMLElement, GROUPS, "aimai", () => {});
    buildTabs(nav as unknown as HTMLElement, GROUPS, "mizutama", () => {});
    expect(nav.querySelectorAll("button[role='tab']").length).toBe(3);
    const selected = nav.querySelector("button[aria-selected='true']");
    expect((selected as HTMLButtonElement).getAttribute("data-group")).toBe("mizutama");
  });
});
