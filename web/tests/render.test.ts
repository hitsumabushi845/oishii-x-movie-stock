import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderList, replaceList } from "../src/render.js";
import type { Video } from "../src/types.js";

const v = (id: string, posted = "2026-04-01T00:00:00Z"): Video => ({
  id,
  url: `https://x.com/official_aimai/status/${id}`,
  posted_at: posted,
  duration_sec: 65,
  text: `tweet ${id}`,
  tags: [],
});

beforeEach(() => {
  document.body.innerHTML = `<div id="list"></div>`;
});

describe("renderList", () => {
  it("creates one row per video with the play button", () => {
    const list = document.getElementById("list") as HTMLElement;
    renderList(list, [v("1"), v("2")], { embed: vi.fn() });
    const rows = list.querySelectorAll(".row");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.querySelector(".play-btn")).toBeTruthy();
  });

  it("clicking play button calls embed and toggles to close", () => {
    const list = document.getElementById("list") as HTMLElement;
    const embed = vi.fn();
    renderList(list, [v("1")], { embed });
    const btn = list.querySelector(".play-btn") as HTMLButtonElement;
    btn.click();
    expect(embed).toHaveBeenCalledTimes(1);
    expect(btn.textContent).toContain("閉じる");
  });

  it("clicking close removes the embed container", () => {
    const list = document.getElementById("list") as HTMLElement;
    renderList(list, [v("1")], { embed: vi.fn() });
    const btn = list.querySelector(".play-btn") as HTMLButtonElement;
    btn.click();
    expect(list.querySelector(".embed-host")).toBeTruthy();
    btn.click();
    expect(list.querySelector(".embed-host")).toBeNull();
  });
});

describe("replaceList", () => {
  it("clears previous content and renders new", () => {
    const list = document.getElementById("list") as HTMLElement;
    renderList(list, [v("1")], { embed: vi.fn() });
    replaceList(list, [v("2"), v("3")], { embed: vi.fn() });
    const ids = Array.from(list.querySelectorAll(".row")).map((r) => r.getAttribute("data-id"));
    expect(ids).toEqual(["2", "3"]);
  });
});
