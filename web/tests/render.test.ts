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

  it("displays the post date and duration", () => {
    const list = document.getElementById("list")!;
    renderList(list, [v("1", "2020-10-31T09:00:00Z", 65)], { embed: vi.fn() });
    expect(list.querySelector("time")?.dateTime).toBe("2020-10-31T09:00:00Z");
    expect(list.querySelector("time")?.textContent).toBe("2020.10.31");
    expect(list.querySelector(".entry__time")?.textContent).toBe("1:05");
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

describe("list updates", () => {
  it("keeps an open embed when the same video remains in the results", () => {
    const list = document.getElementById("list")!;
    renderList(list, [v("1"), v("2")], { embed: vi.fn() });
    list.querySelector<HTMLButtonElement>(".entry__summary")!.click();
    const entry = list.firstElementChild;
    const host = entry!.querySelector(".embed-host");
    replaceList(list, [v("1")], { embed: vi.fn() });
    expect(list.firstElementChild).toBe(entry);
    expect(list.querySelector(".embed-host")).toBe(host);
  });
  it("shows an X link when embedding fails and permits retry by reopening", async () => {
    const list = document.getElementById("list")!;
    const embed = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    renderList(list, [v("1")], { embed });
    const button = list.querySelector<HTMLButtonElement>(".entry__summary")!;
    button.click();
    await vi.waitFor(() => expect(list.querySelector('[role="status"]')?.textContent).toContain("読み込めません"));
    expect(list.querySelector("a")?.href).toBe("https://x.com/official_aimai/status/1");
    button.click();
    button.click();
    expect(embed).toHaveBeenCalledTimes(2);
  });
});
