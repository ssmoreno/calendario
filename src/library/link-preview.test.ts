import { describe, expect, it } from "vitest";

import { parseLinkPreview } from "./link-preview";

const PAGE = "https://example.com/posts/solid-state";

describe("parseLinkPreview", () => {
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
});
