import { describe, expect, it } from "vitest";

import { storeLinkFor } from "./store-link";

describe("storeLinkFor", () => {
  it("recognizes Amazon storefronts in any locale", () => {
    expect(storeLinkFor("https://www.amazon.com/dp/0060935464")?.tag).toBe(
      "Book",
    );
    expect(storeLinkFor("https://amazon.co.uk/dp/0060935464")?.tag).toBe(
      "Book",
    );
    expect(storeLinkFor("https://www.amazon.com.mx/dp/0060935464")?.tag).toBe(
      "Book",
    );
  });

  it("recognizes Spotify web pages", () => {
    expect(
      storeLinkFor("https://open.spotify.com/album/1weenld61qoidwYuZ1GESA")
        ?.tag,
    ).toBe("Music");
  });

  it("ignores look-alike hosts and anything else", () => {
    expect(storeLinkFor("https://notamazon.com/dp/0060935464")).toBeNull();
    expect(storeLinkFor("https://amazon.com.evil.test/dp/1")).toBeNull();
    expect(storeLinkFor("https://spotify.com/album/1")).toBeNull();
    expect(storeLinkFor("https://example.com/guide")).toBeNull();
    expect(storeLinkFor("not a url")).toBeNull();
  });
});
