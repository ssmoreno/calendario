import { Buffer } from "node:buffer";
import { defineEval } from "eve/evals";
import { equals, satisfies } from "eve/evals/expect";

import type { LibraryItemRecord } from "../../src/library/types";
import { prisma } from "../../src/server/db";
import { listLibrary } from "../../src/server/library-store";
import {
  ensureLibraryEvalUser,
  isStandaloneRead,
  LIBRARY_EVAL_USER_ID,
} from "./helpers";

const PDF_URL = "https://arxiv.org/pdf/1706.03762";

const itemFilter = {
  userId: LIBRARY_EVAL_USER_ID,
  link: null,
  title: { contains: "Attention Is All You Need", mode: "insensitive" as const },
};

function isUsefulUploadedPaper(value: unknown): boolean {
  const item = value as LibraryItemRecord | undefined;
  const note = item?.note?.toLowerCase();
  return Boolean(
    item?.link === null &&
      item.tags.includes("Paper") &&
      isStandaloneRead(item.note) &&
      note?.includes("attention") &&
      ["encoder", "decoder", "translation", "bleu", "recurrent"].some(
        (term) => note.includes(term),
      ),
  );
}

export default defineEval({
  description:
    "An uploaded PDF is read directly, researched, and saved as knowledge without retaining the file or inventing a link.",
  async test(t) {
    await ensureLibraryEvalUser();
    await prisma.libraryItem.deleteMany({ where: itemFilter });

    try {
      const response = await fetch(PDF_URL);
      if (!response.ok) throw new Error("Could not load the PDF fixture.");
      const data = Buffer.from(await response.arrayBuffer()).toString("base64");

      await t.send([
        { type: "text", text: "Save this PDF to my library." },
        {
          type: "file",
          data: `data:application/pdf;base64,${data}`,
          filename: "attention-is-all-you-need.pdf",
          mediaType: "application/pdf",
        },
      ]);
      const saved = (await listLibrary(LIBRARY_EVAL_USER_ID)).items.find(
        (item) => item.title.toLowerCase().includes("attention is all you need"),
      );
      const savedCount = await prisma.libraryItem.count({ where: itemFilter });

      t.succeeded();
      t.noFailedActions();
      t.calledTool("web_search", { count: (count) => count >= 1 });
      t.calledTool("save_library_item", { count: (count) => count >= 1 });
      t.notCalledTool("save_library_link");
      t.check(t.reply, equals("✅")).label("confirmation");
      t.check(savedCount, equals(1)).label("one stored copy after retries");
      t.check(
        saved,
        satisfies(isUsefulUploadedPaper, "saved a useful uploaded-paper read"),
      );
    } finally {
      await prisma.libraryItem.deleteMany({ where: itemFilter });
    }
  },
});
