import { describe, expect, it } from "vitest";

import { libraryItemSchema, libraryTagsSchema } from "./types";

describe("library schemas", () => {
  it("trims item text and keeps broad tags", () => {
    expect(
      libraryItemSchema.parse({
        title: "  Guide  ",
        description: "  Useful reference  ",
        link: "https://example.com/guide",
        tags: ["Documentation", "Coding"],
      }),
    ).toEqual({
      title: "Guide",
      description: "Useful reference",
      link: "https://example.com/guide",
      tags: ["Documentation", "Coding"],
    });
  });

  it("accepts only http and https links", () => {
    const input = {
      title: "Guide",
      description: "Reference",
      tags: ["Reference"],
    };
    expect(
      libraryItemSchema.safeParse({ ...input, link: "https://example.com" })
        .success,
    ).toBe(true);
    expect(
      libraryItemSchema.safeParse({ ...input, link: "ftp://example.com" })
        .success,
    ).toBe(false);
  });

  it("rejects narrow, duplicate, or excessive tags", () => {
    expect(libraryTagsSchema.safeParse(["Article", "Article"]).success).toBe(
      false,
    );
    expect(libraryTagsSchema.safeParse(["React"]).success).toBe(false);
    expect(
      libraryTagsSchema.safeParse(["Article", "Coding", "Design", "Tool"])
        .success,
    ).toBe(false);
  });
});
