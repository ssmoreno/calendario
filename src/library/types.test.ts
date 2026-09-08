import { describe, expect, it } from "vitest";

import { categoryNameSchema, libraryItemSchema } from "./types";

describe("library schemas", () => {
  it("trims category and item text", () => {
    expect(categoryNameSchema.parse("  Reading  ")).toBe("Reading");
    expect(
      libraryItemSchema.parse({
        categoryId: "category-1",
        name: "  Guide  ",
        description: "  Useful reference  ",
        link: "https://example.com/guide",
      }),
    ).toEqual({
      categoryId: "category-1",
      name: "Guide",
      description: "Useful reference",
      link: "https://example.com/guide",
    });
  });

  it("accepts only http and https links", () => {
    const input = {
      categoryId: "category-1",
      name: "Guide",
      description: "Reference",
    };
    expect(libraryItemSchema.safeParse({ ...input, link: "https://example.com" }).success).toBe(true);
    expect(libraryItemSchema.safeParse({ ...input, link: "ftp://example.com" }).success).toBe(false);
  });
});
