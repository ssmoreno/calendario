import { defineEval } from "eve/evals";
import { equals, satisfies } from "eve/evals/expect";

import type { LibraryItemRecord } from "../../src/library/types";
import { prisma } from "../../src/server/db";
import { listLibrary } from "../../src/server/library-store";
import {
  ensureLibraryEvalUser,
  LIBRARY_EVAL_USER_ID,
} from "./helpers";

const itemFilter = {
  userId: LIBRARY_EVAL_USER_ID,
  link: null,
  title: { contains: "Kind of Blue", mode: "insensitive" as const },
};

function isGroundedAlbum(value: unknown): boolean {
  const item = value as LibraryItemRecord | undefined;
  return Boolean(
    item?.link === null &&
      item.title.toLowerCase().includes("kind of blue") &&
      item.description.toLowerCase().includes("miles davis") &&
      item.tags.includes("Music"),
  );
}

export default defineEval({
  description:
    "A named work can be researched and saved without a URL or an unsolicited long read.",
  async test(t) {
    await ensureLibraryEvalUser();
    await prisma.libraryItem.deleteMany({ where: itemFilter });

    try {
      await t.send("Save the album Kind of Blue by Miles Davis to my library.");
      const saved = (await listLibrary(LIBRARY_EVAL_USER_ID)).items.find(
        (item) => item.title.toLowerCase().includes("kind of blue"),
      );

      t.succeeded();
      t.noFailedActions();
      t.calledTool("web_search", { count: (count) => count >= 1 });
      t.calledTool("save_library_item", { count: 1 });
      t.notCalledTool("save_library_link");
      t.check(t.reply, equals("✅")).label("confirmation");
      t.check(saved, satisfies(isGroundedAlbum, "saved a grounded Music item"));
      t.check(
        saved?.note?.split(/\s+/u).length ?? 0,
        satisfies((words: number) => words < 160, "did not invent a long read"),
      );
    } finally {
      await prisma.libraryItem.deleteMany({ where: itemFilter });
    }
  },
});
