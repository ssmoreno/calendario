import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchLinkPreview, parseLinkPreview } from "./link-preview";

vi.mock("./public-url", () => ({
  assertPublicUrl: (url: string) => new URL(url),
}));

const PAGE = "https://example.com/posts/solid-state";

describe("parseLinkPreview", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the Open Graph tags of a page", () => {
    const preview = parseLinkPreview(
      `<html><head>
        <title>Ignored</title>
        <meta property="og:site_name" content="Example Journal">
        <meta property="og:title" content="Solid-state cells &amp; the grid">
        <meta property="og:description" content='Why the &quot;next&quot; battery matters.'>
        <meta property="og:image" content="/images/cell.png">
        <link rel="apple-touch-icon" href="/touch.png">
        <link rel="icon" href="//example.com/favicon.png">
      </head><body><meta property="og:title" content="From the body"></body></html>`,
      PAGE,
    );

    expect(preview).toEqual({
      title: "Solid-state cells & the grid",
      description: 'Why the "next" battery matters.',
      image: "https://example.com/images/cell.png",
      icon: "https://example.com/favicon.png",
      siteName: "Example Journal",
    });
  });

  it("falls back to the document title, twitter tags, and the default favicon", () => {
    const preview = parseLinkPreview(
      `<head>
        <title>
          A plain
          page
        </title>
        <meta name="twitter:image" content="https://cdn.example.com/card.jpg">
        <meta name="description" content="Saved without Open Graph tags.">
      </head>`,
      PAGE,
    );

    expect(preview).toEqual({
      title: "A plain page",
      description: "Saved without Open Graph tags.",
      image: "https://cdn.example.com/card.jpg",
      icon: "https://example.com/favicon.ico",
      siteName: null,
    });
  });

  it("drops images that are not http links and truncates long text", () => {
    const preview = parseLinkPreview(
      `<head>
        <meta property="og:image" content="data:image/png;base64,AAAA">
        <meta property="og:description" content="${"word ".repeat(120)}">
      </head>`,
      PAGE,
    );

    expect(preview.image).toBeNull();
    expect(preview.description).toHaveLength(280);
    expect(preview.description).toMatch(/…$/u);
  });

  it("returns nothing to show for a page without a head", () => {
    expect(parseLinkPreview("<p>hello</p>", PAGE)).toEqual({
      title: null,
      description: null,
      image: null,
      icon: "https://example.com/favicon.ico",
      siteName: null,
    });
  });

  it("derives a thumbnail for a YouTube short link without preview tags", () => {
    expect(
      parseLinkPreview(
        "<head><title>A saved video</title></head>",
        "https://youtu.be/dQw4w9WgXcQ",
      ),
    ).toEqual({
      title: "A saved video",
      description: null,
      image: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      icon: "https://www.youtube.com/favicon.ico",
      siteName: "YouTube",
    });
  });

  it("keeps the YouTube thumbnail when the source page cannot be fetched", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("blocked")));

    await expect(fetchLinkPreview("https://youtu.be/dQw4w9WgXcQ")).resolves.toEqual({
      title: null,
      description: null,
      image: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      icon: "https://www.youtube.com/favicon.ico",
      siteName: "YouTube",
    });
  });
});
