import { defineEval } from "eve/evals";
import { equals, satisfies } from "eve/evals/expect";

import type { LibraryItemRecord } from "../../src/library/types";
import { prisma } from "../../src/server/db";
import { listLibrary } from "../../src/server/library-store";
import {
  attachLinkCuratorSession,
  ensureLibraryEvalUser,
  LIBRARY_EVAL_USER_ID,
} from "./helpers";

const LINK = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

export default defineEval({
  description:
    "A YouTube URL is grounded through fetch and search, saved, and acknowledged.",
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
      curator.calledTool("web_fetch", { count: (count) => count >= 1 });
      curator.calledTool("web_search", { count: (count) => count >= 1 });
      t.check(t.reply, equals("✅")).label("confirmation");
      t.check(
        saved,
        satisfies(
          (value) => {
            const item = value as LibraryItemRecord | undefined;
            return Boolean(
              item?.title && item.note && item.tags.includes("Video"),
            );
          },
          "saved grounded video metadata",
        ),
      );
    } finally {
      await prisma.libraryItem.deleteMany({
        where: { userId: LIBRARY_EVAL_USER_ID, link: LINK },
      });
    }
  },
});
