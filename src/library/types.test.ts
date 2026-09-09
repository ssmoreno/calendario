import { describe, expect, it } from "vitest";

import { libraryItemSchema, libraryTagsSchema } from "./types";

const summary = "Prisma types your queries end to end. ".repeat(8);

describe("library schemas", () => {
  it("trims item text and keeps broad tags", () => {
    expect(
      libraryItemSchema.parse({
        title: "  Guide  ",
        description: "  Useful reference  ",
        summary: `  ${summary}  `,
        link: "https://example.com/guide",
        tags: ["Documentation", "Coding"],
      }),
    ).toEqual({
      title: "Guide",
      description: "Useful reference",
      summary: summary.trim(),
      link: "https://example.com/guide",
      tags: ["Documentation", "Coding"],
    });
  });

  it("keeps the read optional but long enough to be one", () => {
    const input = {
      title: "Guide",
      description: "Reference",
      link: "https://example.com/guide",
      tags: ["Reference"],
    };
    expect(libraryItemSchema.safeParse(input).success).toBe(true);
    expect(
      libraryItemSchema.safeParse({ ...input, summary: "Too short." }).success,
    ).toBe(false);
    expect(
      libraryItemSchema.safeParse({ ...input, summary: summary.repeat(20) })
        .success,
    ).toBe(false);
  });

  it("holds the description to one short line", () => {
    expect(
      libraryItemSchema.safeParse({
        title: "Guide",
        description: "x".repeat(241),
        link: "https://example.com/guide",
        tags: ["Reference"],
      }).success,
    ).toBe(false);
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
