import { describe, expect, it, vi } from "vitest";

import { fetchLinkMetadata, parseLinkMetadata } from "./link-metadata";

const publicHost = async () => ["93.184.216.34"];

function htmlResponse(html: string, init: ResponseInit = {}): Response {
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
    ...init,
  });
}

describe("parseLinkMetadata", () => {
  it("prefers Open Graph over the document title", () => {
    expect(
      parseLinkMetadata(
        `<html><head><title>Site name</title>
         <meta property="og:title" content="Cacio e Pepe">
         <meta property="og:description" content="Four ingredients."></head></html>`,
      ),
    ).toEqual({ title: "Cacio e Pepe", summary: "Four ingredients." });
  });

  it("falls back to the title tag and meta description", () => {
    expect(
      parseLinkMetadata(
        `<head><title>  Braised\n  Short Ribs </title>
         <meta name="description" content="Sunday cooking."></head>`,
      ),
    ).toEqual({ title: "Braised Short Ribs", summary: "Sunday cooking." });
  });

  it("decodes entities", () => {
    expect(
      parseLinkMetadata("<title>Salt &amp; Pepper &#8212; Recipe</title>").title,
    ).toBe("Salt & Pepper — Recipe");
  });

  it("returns nulls when the page says nothing", () => {
    expect(parseLinkMetadata("<html><body>hi</body></html>")).toEqual({
      title: null,
      summary: null,
    });
  });
});

describe("fetchLinkMetadata", () => {
  it("reads a public page", async () => {
    const fetcher = vi.fn(async () =>
      htmlResponse('<meta property="og:title" content="Ragu">'),
    );

    await expect(
      fetchLinkMetadata("https://example.com/ragu", {
        fetch: fetcher as unknown as typeof fetch,
        lookupHost: publicHost,
      }),
    ).resolves.toEqual({ title: "Ragu", summary: null });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("refuses loopback and private literals without fetching", async () => {
    const fetcher = vi.fn();
    for (const url of [
      "http://127.0.0.1/admin",
      "http://10.1.2.3/",
      "http://169.254.169.254/latest/meta-data/",
      "http://192.168.0.1/",
      "http://[::1]/",
    ]) {
      await expect(
        fetchLinkMetadata(url, {
          fetch: fetcher as unknown as typeof fetch,
          lookupHost: publicHost,
        }),
      ).resolves.toEqual({ title: null, summary: null });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refuses a public name that resolves to a private address", async () => {
    const fetcher = vi.fn();

    await expect(
      fetchLinkMetadata("https://intranet.example.com/", {
        fetch: fetcher as unknown as typeof fetch,
        lookupHost: async () => ["10.0.0.5"],
      }),
    ).resolves.toEqual({ title: null, summary: null });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refuses non-http schemes", async () => {
    const fetcher = vi.fn();

    await expect(
      fetchLinkMetadata("file:///etc/passwd", {
        fetch: fetcher as unknown as typeof fetch,
        lookupHost: publicHost,
      }),
    ).resolves.toEqual({ title: null, summary: null });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("re-checks the host on every redirect hop", async () => {
    const fetcher = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data/" },
      }),
    );

    await expect(
      fetchLinkMetadata("https://example.com/go", {
        fetch: fetcher as unknown as typeof fetch,
        lookupHost: publicHost,
      }),
    ).resolves.toEqual({ title: null, summary: null });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("follows a redirect that stays public", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { location: "https://example.com/final" },
        }),
      )
      .mockResolvedValueOnce(htmlResponse("<title>Final</title>"));

    await expect(
      fetchLinkMetadata("https://example.com/start", {
        fetch: fetcher as unknown as typeof fetch,
        lookupHost: publicHost,
      }),
    ).resolves.toEqual({ title: "Final", summary: null });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("gives up on a redirect loop instead of following forever", async () => {
    const fetcher = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://example.com/loop" },
      }),
    );

    await expect(
      fetchLinkMetadata("https://example.com/loop", {
        fetch: fetcher as unknown as typeof fetch,
        lookupHost: publicHost,
      }),
    ).resolves.toEqual({ title: null, summary: null });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("ignores responses that are not HTML", async () => {
    const fetcher = vi.fn(async () =>
      new Response("%PDF-1.7", {
        headers: { "content-type": "application/pdf" },
      }),
    );

    await expect(
      fetchLinkMetadata("https://example.com/paper.pdf", {
        fetch: fetcher as unknown as typeof fetch,
        lookupHost: publicHost,
      }),
    ).resolves.toEqual({ title: null, summary: null });
  });

  it("saves without a title when the request fails", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("network down");
    });

    await expect(
      fetchLinkMetadata("https://example.com/", {
        fetch: fetcher as unknown as typeof fetch,
        lookupHost: publicHost,
      }),
    ).resolves.toEqual({ title: null, summary: null });
  });

  it("stops reading a page that never ends", async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode("<p>filler</p>".repeat(64)));
      },
    });
    const fetcher = vi.fn(async () =>
      new Response(stream, {
        headers: { "content-type": "text/html" },
      }),
    );

    await expect(
      fetchLinkMetadata("https://example.com/endless", {
        fetch: fetcher as unknown as typeof fetch,
        lookupHost: publicHost,
      }),
    ).resolves.toEqual({ title: null, summary: null });
  });
});
