import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderList, replaceList } from "../src/render.js";
import type { Video } from "../src/types.js";

const v = (id: string, posted = "2026-04-01T00:00:00Z", duration = 65): Video => ({
  id,
  url: `https://x.com/official_aimai/status/${id}`,
  posted_at: posted,
  duration_sec: duration,
  text: `tweet ${id}`,
  tags: [],
});

beforeEach(() => {
  document.body.innerHTML = `<div id="list"></div>`;
});

describe("renderList", () => {
  it("creates one entry per video with a disclosure summary", () => {
    const list = document.getElementById("list") as HTMLElement;
    renderList(list, [v("1"), v("2")], { embed: vi.fn() });
    const entries = list.querySelectorAll(".entry");
    expect(entries).toHaveLength(2);
    const summary = entries[0]?.querySelector(".entry__summary");
    expect(summary).toBeTruthy();
    expect(summary?.getAttribute("aria-expanded")).toBe("false");
  });

  it("splits the date into a muted year and a prominent month.day", () => {
    const list = document.getElementById("list") as HTMLElement;
    renderList(list, [v("1", "2020-10-31T09:00:00Z")], { embed: vi.fn() });
    expect(list.querySelector(".entry__year")?.textContent).toBe("2020");
    expect(list.querySelector(".entry__day")?.textContent).toBe("10.31");
  });

  it("sizes the duration meter so a longer clip fills more of the track", () => {
    const list = document.getElementById("list") as HTMLElement;
    renderList(list, [v("short", "2026-04-01T00:00:00Z", 30), v("long", "2026-04-01T00:00:00Z", 240)], {
      embed: vi.fn(),
    });
    const fills = Array.from(list.querySelectorAll<HTMLElement>(".meter__fill")).map((el) =>
      parseFloat(el.style.getPropertyValue("--fill")),
    );
    expect(fills[0]).toBeGreaterThan(0);
    expect(fills[1]).toBeGreaterThan(fills[0]!);
    expect(fills[1]).toBeLessThanOrEqual(100);
  });

  it("caps the meter at the longest expressible runtime", () => {
    const list = document.getElementById("list") as HTMLElement;
    renderList(list, [v("1", "2026-04-01T00:00:00Z", 5000)], { embed: vi.fn() });
    const fill = list.querySelector<HTMLElement>(".meter__fill")!;
    expect(parseFloat(fill.style.getPropertyValue("--fill"))).toBe(100);
  });

  it("expanding calls embed and marks the entry open", () => {
    const list = document.getElementById("list") as HTMLElement;
    const embed = vi.fn();
    renderList(list, [v("1")], { embed });
    const summary = list.querySelector(".entry__summary") as HTMLButtonElement;
    summary.click();
    expect(embed).toHaveBeenCalledTimes(1);
    expect(summary.getAttribute("aria-expanded")).toBe("true");
    expect(list.querySelector(".entry")?.classList.contains("is-open")).toBe(true);
  });

  it("collapsing removes the embed container and resets the open state", () => {
    const list = document.getElementById("list") as HTMLElement;
    renderList(list, [v("1")], { embed: vi.fn() });
    const summary = list.querySelector(".entry__summary") as HTMLButtonElement;
    summary.click();
    expect(list.querySelector(".embed-host")).toBeTruthy();
    summary.click();
    expect(list.querySelector(".embed-host")).toBeNull();
    expect(summary.getAttribute("aria-expanded")).toBe("false");
    expect(list.querySelector(".entry")?.classList.contains("is-open")).toBe(false);
  });
});

describe("replaceList", () => {
  it("clears previous content and renders new", () => {
    const list = document.getElementById("list") as HTMLElement;
    renderList(list, [v("1")], { embed: vi.fn() });
    replaceList(list, [v("2"), v("3")], { embed: vi.fn() });
    const ids = Array.from(list.querySelectorAll(".entry")).map((r) => r.getAttribute("data-id"));
    expect(ids).toEqual(["2", "3"]);
  });
});
