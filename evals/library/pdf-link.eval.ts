import { defineEval } from "eve/evals";
import { equals, satisfies } from "eve/evals/expect";

import type { LibraryItemRecord } from "../../src/library/types";
import { prisma } from "../../src/server/db";
import { listLibrary } from "../../src/server/library-store";
import {
  attachLinkCuratorSession,
  ensureLibraryEvalUser,
  isStandaloneRead,
  LIBRARY_EVAL_USER_ID,
} from "./helpers";

const LINK = "https://arxiv.org/pdf/1706.03762";

function isUsefulPaper(value: unknown): boolean {
  const item = value as LibraryItemRecord | undefined;
  const summary = item?.summary?.toLowerCase();

  if (!item?.title || !summary || !item.tags.includes("Paper")) {
    return false;
  }

  const hasPaperSubstance =
    summary.includes("attention") &&
    ["encoder", "decoder", "translation", "bleu", "recurrent"].some(
      (term) => summary.includes(term),
    );
  return isStandaloneRead(summary) && hasPaperSubstance;
}

export default defineEval({
  description:
    "A PDF URL is researched beyond its binary response and saved as a substantive standalone read.",
  async test(t) {
    await ensureLibraryEvalUser();
    await prisma.libraryItem.deleteMany({
      where: { userId: LIBRARY_EVAL_USER_ID, link: LINK },
    });

    try {
      await t.send(LINK);
      const curator = await attachLinkCuratorSession(t);
      const saved = (await listLibrary(LIBRARY_EVAL_USER_ID)).items.find(
        (item) => item.link === LINK,
      );

      t.succeeded();
      t.noFailedActions();
      t.calledSubagent("link_curator", { count: 1 });
      t.calledTool("save_library_link", { count: 1, input: { link: LINK } });
      curator.succeeded();
      curator.noFailedActions();
      curator.calledTool("web_fetch", { count: (count) => count >= 2 });
      curator.calledTool("web_search", { count: (count) => count >= 1 });
      t.check(t.reply, equals("✅")).label("confirmation");
      t.check(saved, satisfies(isUsefulPaper, "saved a useful paper read"));
    } finally {
      await prisma.libraryItem.deleteMany({
        where: { userId: LIBRARY_EVAL_USER_ID, link: LINK },
      });
    }
  },
});
