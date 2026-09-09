import { describe, expect, it } from "vitest";

import {
  automaticLibraryTagsSchema,
  libraryAgentItemSchema,
  libraryItemSchema,
  libraryLinkItemSchema,
  libraryTagsSchema,
  normalizeLibraryTagName,
  updateLibraryItemSchema,
} from "./types";

const note = "Prisma types your queries end to end. ".repeat(8);

describe("library schemas", () => {
  it("trims item text and cleans tag whitespace", () => {
    expect(
      libraryItemSchema.parse({
        title: "  Guide  ",
        description: "  Useful reference  ",
        note: `  ${note}  `,
        link: "https://example.com/guide",
        tags: ["  Documentation  ", "Reading   List"],
      }),
    ).toEqual({
      title: "Guide",
      description: "Useful reference",
      note: note.trim(),
      link: "https://example.com/guide",
      tags: ["Documentation", "Reading List"],
    });
  });

  it("keeps a note optional and accepts faithful short source text", () => {
    const input = {
      title: "Guide",
      description: "Reference",
      link: "https://example.com/guide",
      tags: ["Reference"],
    };
    expect(libraryItemSchema.safeParse(input).success).toBe(true);
    expect(
      libraryItemSchema.safeParse({ ...input, note: "Too short." }).success,
    ).toBe(true);
    expect(
      libraryItemSchema.safeParse({ ...input, note: note.repeat(20) })
        .success,
    ).toBe(false);
  });

  it("requires every curated link to keep a note", () => {
    const input = {
      title: "A short post",
      description: "One useful sentence.",
      link: "https://example.com/post",
      tags: ["Post"],
    };
    expect(libraryLinkItemSchema.safeParse(input).success).toBe(false);
    expect(
      libraryLinkItemSchema.safeParse({ ...input, note: "Keep this directly." })
        .success,
    ).toBe(true);
  });

  it("links a book to Amazon and music to Spotify, and nothing else", () => {
    const book = {
      title: "To Kill a Mockingbird",
      description: "A novel about justice and moral courage.",
      tags: ["Book"],
    };
    const album = {
      title: "Kind of Blue",
      description: "Miles Davis's 1959 modal jazz album.",
      tags: ["Music"],
    };
    expect(libraryAgentItemSchema.safeParse(book).success).toBe(true);
    expect(
      libraryAgentItemSchema.safeParse({
        ...book,
        link: "https://www.amazon.com/dp/0060935464",
      }).success,
    ).toBe(true);
    expect(
      libraryAgentItemSchema.safeParse({
        ...album,
        link: "https://open.spotify.com/album/1weenld61qoidwYuZ1GESA",
      }).success,
    ).toBe(true);
    expect(
      libraryAgentItemSchema.safeParse({
        ...book,
        link: "https://open.spotify.com/album/1weenld61qoidwYuZ1GESA",
      }).success,
    ).toBe(false);
    expect(
      libraryAgentItemSchema.safeParse({
        title: "Roast chicken",
        description: "A weeknight roast.",
        tags: ["Recipe"],
        link: "https://www.amazon.com/dp/0060935464",
      }).success,
    ).toBe(false);
  });

  it("allows an understood item without storing its attachment or a link", () => {
    expect(
      libraryItemSchema.safeParse({
        title: "To Kill a Mockingbird",
        description: "A novel about justice and moral courage.",
        note,
        tags: ["Book"],
      }).success,
    ).toBe(true);
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

  it("accepts custom tags and rejects case-insensitive duplicates or excess", () => {
    expect(libraryTagsSchema.safeParse(["React"]).success).toBe(true);
    expect(libraryTagsSchema.safeParse(["Article", " article "]).success).toBe(
      false,
    );
    expect(
      libraryTagsSchema.safeParse(["Article", "Coding", "Design", "Tool"])
        .success,
    ).toBe(false);
  });

  it("keeps agent-generated tags within the standard broad set", () => {
    expect(
      automaticLibraryTagsSchema.safeParse(["Book", "Music", "Post"]).success,
    ).toBe(true);
    expect(automaticLibraryTagsSchema.safeParse(["Books"]).success).toBe(
      false,
    );
    expect(
      automaticLibraryTagsSchema.safeParse(["Research Paper"]).success,
    ).toBe(false);
  });

  it("normalizes tag identity independently from display casing", () => {
    expect(normalizeLibraryTagName("  Reading   LIST ")).toBe("reading list");
  });

  it("requires at least one item field to update", () => {
    expect(
      updateLibraryItemSchema.safeParse({ itemId: "item-1", changes: {} })
        .success,
    ).toBe(false);
    expect(
      updateLibraryItemSchema.safeParse({
        itemId: "item-1",
        changes: { note: null },
      }).success,
    ).toBe(true);
    expect(
      updateLibraryItemSchema.safeParse({
        itemId: "item-1",
        changes: { link: null },
      }).success,
    ).toBe(true);
  });
});
