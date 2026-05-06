import { describe, it, expect, beforeAll } from "vitest";
import { Window } from "happy-dom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(
  path.join(__dirname, "..", "index.html"),
  "utf-8",
);

const SITE_URL = "https://hitsumabushi845.github.io/aimai-x-movie-stock/";
const IMAGE_URL = `${SITE_URL}aimai_movie_stock.png`;
const DESCRIPTION =
  "@official_aimai のライブダイジェスト等の動画一覧。X 投稿動画を一覧 / 検索 / 並び替えできる非公式ファンサイト。";
const IMAGE_ALT =
  "aimai movie stock — Archive of videos from Oishii Aimai's Official X (Unofficial)";

function parseHead(): Document {
  const window = new Window();
  window.document.write(html);
  return window.document as unknown as Document;
}

function metaContent(
  doc: Document,
  attr: "name" | "property",
  key: string,
): string | null {
  const el = doc.querySelector(`meta[${attr}="${key}"]`);
  return el ? el.getAttribute("content") : null;
}

describe("index.html metadata", () => {
  let doc: Document;
  beforeAll(() => {
    doc = parseHead();
  });

  it("has a non-empty meta description", () => {
    expect(metaContent(doc, "name", "description")).toBe(DESCRIPTION);
  });

  it("has og:type = website", () => {
    expect(metaContent(doc, "property", "og:type")).toBe("website");
  });

  it("has og:site_name", () => {
    expect(metaContent(doc, "property", "og:site_name")).toBe(
      "aimai movie stock",
    );
  });

  it("has og:title matching the page title", () => {
    expect(metaContent(doc, "property", "og:title")).toBe("aimai movie stock");
  });

  it("has og:description", () => {
    expect(metaContent(doc, "property", "og:description")).toBe(DESCRIPTION);
  });

  it("has og:url as canonical absolute URL", () => {
    expect(metaContent(doc, "property", "og:url")).toBe(SITE_URL);
  });

  it("has og:image as absolute URL pointing to the share PNG", () => {
    expect(metaContent(doc, "property", "og:image")).toBe(IMAGE_URL);
  });

  it("declares og:image dimensions matching the source PNG", () => {
    expect(metaContent(doc, "property", "og:image:width")).toBe("1536");
    expect(metaContent(doc, "property", "og:image:height")).toBe("1024");
  });

  it("has og:image:alt", () => {
    expect(metaContent(doc, "property", "og:image:alt")).toBe(IMAGE_ALT);
  });

  it("has og:locale = ja_JP", () => {
    expect(metaContent(doc, "property", "og:locale")).toBe("ja_JP");
  });

  it("uses summary_large_image for the Twitter card", () => {
    expect(metaContent(doc, "name", "twitter:card")).toBe(
      "summary_large_image",
    );
  });
});
