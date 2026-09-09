import { describe, expect, it } from "vitest";

import {
  isLongLibraryNote,
  readingMinutes,
  readingParagraphs,
} from "./reading";

describe("library note reading helpers", () => {
  it("distinguishes direct short notes from synthesized reads", () => {
    expect(isLongLibraryNote("just setting up my twttr")).toBe(false);
    expect(isLongLibraryNote("word ".repeat(160))).toBe(true);
  });

  it("calculates reading time and preserves authored paragraphs", () => {
    expect(readingMinutes("word ".repeat(440))).toBe(2);
    expect(readingParagraphs("First note.\n\n Second note. ")).toEqual([
      "First note.",
      "Second note.",
    ]);
  });
});
