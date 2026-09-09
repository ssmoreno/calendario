import { Buffer } from "node:buffer";
import { defineEval } from "eve/evals";
import { equals, satisfies } from "eve/evals/expect";

import type { LibraryItemRecord } from "../../src/library/types";
import { prisma } from "../../src/server/db";
import { listLibrary } from "../../src/server/library-store";
import {
  ensureLibraryEvalUser,
  LIBRARY_EVAL_USER_ID,
} from "./helpers";

const COVER_URL =
  "https://covers.openlibrary.org/b/isbn/9780061120084-L.jpg";

const itemFilter = {
  userId: LIBRARY_EVAL_USER_ID,
  link: null,
  title: { contains: "Mockingbird", mode: "insensitive" as const },
};

function isUsefulBook(value: unknown): boolean {
  const item = value as LibraryItemRecord | undefined;
  const content = [item?.title, item?.description, item?.note]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return Boolean(
    item?.link === null &&
      item.title.toLowerCase().includes("mockingbird") &&
      item.tags.includes("Book") &&
      ["harper", "lee", "scout", "finch", "justice", "race"].some((term) =>
        content.includes(term),
      ) &&
      !/\b(?:image|cover|photo|picture) (?:shows|contains|depicts)\b/iu.test(
        content,
      ),
  );
}

export default defineEval({
  description:
    "A book-cover image becomes a researched Book entry without forcing an unsolicited long read.",
  async test(t) {
    await ensureLibraryEvalUser();
    await prisma.libraryItem.deleteMany({ where: itemFilter });

    try {
      const response = await fetch(COVER_URL);
      if (!response.ok) throw new Error("Could not load the book-cover fixture.");
      const data = Buffer.from(await response.arrayBuffer()).toString("base64");

      await t.send([
        { type: "text", text: "Save this to my library." },
        {
          type: "file",
          data: `data:image/jpeg;base64,${data}`,
          filename: "book-cover.jpg",
          mediaType: "image/jpeg",
        },
      ]);
      const saved = (await listLibrary(LIBRARY_EVAL_USER_ID)).items.find(
        (item) => item.title.toLowerCase().includes("mockingbird"),
      );
      const savedCount = await prisma.libraryItem.count({ where: itemFilter });

      t.succeeded();
      t.noFailedActions();
      t.calledTool("web_search", { count: (count) => count >= 1 });
      t.calledTool("save_library_item", { count: (count) => count >= 1 });
      t.notCalledTool("save_library_link");
      t.check(t.reply, equals("✅")).label("confirmation");
      t.check(savedCount, equals(1)).label("one stored copy after retries");
      t.check(saved, satisfies(isUsefulBook, "saved a useful Book entry"));
    } finally {
      await prisma.libraryItem.deleteMany({ where: itemFilter });
    }
  },
});
