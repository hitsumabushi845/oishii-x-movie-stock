import { beforeEach, afterEach, it, expect, vi } from "vitest";

let scripts: HTMLScriptElement[] = [];

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  document.head.replaceChildren();
  document.body.innerHTML = '<div id="host"></div>';
  delete window.twttr;
  scripts = [];
  // Capture external script requests without running happy-dom's network loader.
  vi.spyOn(document.head, "appendChild").mockImplementation(node => {
    scripts.push(node as HTMLScriptElement);
    return node;
  });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it("retries the widget script after a failure", async () => {
  const { embedTweet } = await import("../src/embed.js");
  const first = embedTweet("1", document.getElementById("host")!);
  const rejected = expect(first).rejects.toThrow();
  scripts.at(-1)!.dispatchEvent(new Event("error"));
  await rejected;
  const next = embedTweet("1", document.getElementById("host")!);
  window.twttr = { widgets: { createTweet: vi.fn().mockResolvedValue(document.createElement("div")) } };
  scripts.at(-1)?.dispatchEvent(new Event("load"));
  await next;
  expect(window.twttr.widgets.createTweet).toHaveBeenCalledTimes(1);
});

it("does not request a tweet after its row has been closed", async () => {
  const { embedTweet } = await import("../src/embed.js");
  const host = document.getElementById("host")!;
  const pending = embedTweet("1", host);
  host.remove();
  window.twttr = { widgets: { createTweet: vi.fn() } };
  scripts.at(-1)!.dispatchEvent(new Event("load"));
  await pending;
  expect(window.twttr.widgets.createTweet).not.toHaveBeenCalled();
});

it("rejects when X cannot create the tweet", async () => {
  const { embedTweet } = await import("../src/embed.js");
  window.twttr = { widgets: { createTweet: vi.fn().mockResolvedValue(undefined) } };
  await expect(embedTweet("1", document.getElementById("host")!)).rejects.toThrow();
});

it("stops waiting for a script that never responds", async () => {
  const { embedTweet } = await import("../src/embed.js");
  const pending = expect(embedTweet("1", document.getElementById("host")!)).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(15000);
  await pending;
  expect(scripts.at(-1)!.onerror).toBeNull();
});
