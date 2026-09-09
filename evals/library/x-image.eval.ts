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

const LINK = "https://x.com/NASA/status/2040059770237849635/photo/1";

function isUsefulImagePost(value: unknown): boolean {
  const item = value as LibraryItemRecord | undefined;
  const content = [item?.title, item?.description, item?.note]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return Boolean(
    item?.link === LINK &&
      content.includes("earth") &&
      ["aurora", "moon", "blue", "brown"].some((term) =>
        content.includes(term),
      ),
  );
}

export default defineEval({
  description:
    "An X post with a substantive image is visually inspected and saved without forcing a long read.",
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
      curator.calledTool("inspect_x_image", { count: (count) => count >= 1 });
      t.check(t.reply, equals("✅")).label("confirmation");
      t.check(
        saved,
        satisfies(isUsefulImagePost, "saved the post's visual substance"),
      );
    } finally {
      await prisma.libraryItem.deleteMany({
        where: { userId: LIBRARY_EVAL_USER_ID, link: LINK },
      });
    }
  },
});
