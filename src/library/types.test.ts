import { describe, expect, it } from "vitest";

import {
  automaticLibraryTagsSchema,
  libraryItemSchema,
  libraryTagsSchema,
  normalizeLibraryTagName,
  updateLibraryItemSchema,
} from "./types";

const summary = "Prisma types your queries end to end. ".repeat(8);

describe("library schemas", () => {
  it("trims item text and cleans tag whitespace", () => {
    expect(
      libraryItemSchema.parse({
        title: "  Guide  ",
        description: "  Useful reference  ",
        summary: `  ${summary}  `,
        link: "https://example.com/guide",
        tags: ["  Documentation  ", "Reading   List"],
      }),
    ).toEqual({
      title: "Guide",
      description: "Useful reference",
      summary: summary.trim(),
      link: "https://example.com/guide",
      tags: ["Documentation", "Reading List"],
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

  it("allows an understood item without storing its attachment or a link", () => {
    expect(
      libraryItemSchema.safeParse({
        title: "To Kill a Mockingbird",
        description: "A novel about justice and moral courage.",
        summary,
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
    expect(automaticLibraryTagsSchema.safeParse(["Book"]).success).toBe(true);
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
        changes: { summary: null },
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
