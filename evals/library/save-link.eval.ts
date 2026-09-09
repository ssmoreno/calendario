import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

import {
  libraryItemSchema,
  linkCurationSchema,
} from "../../src/library/types";
import { prisma } from "../../src/server/db";
import { listLibrary } from "../../src/server/library-store";
import {
  ensureLibraryEvalUser,
  LIBRARY_EVAL_USER_ID,
} from "./helpers";

const LINK = "https://www.rfc-editor.org/rfc/rfc2606.html";

export default defineEval({
  description:
    "A link is curated by the specialist, saved once, and acknowledged with only a checkmark.",
  async test(t) {
    await ensureLibraryEvalUser();
    await prisma.libraryItem.deleteMany({
      where: { userId: LIBRARY_EVAL_USER_ID, link: LINK },
    });

    try {
      const first = await t.send(LINK);
      const second = await t.send(LINK);
      const firstSave = first.requireToolCall("save_library_link");
      const curationEvent = first.events.find(
        (event) => event.type === "subagent.completed",
      );
      if (!curationEvent) throw new Error("link_curator did not complete");
      const curation = linkCurationSchema.parse(
        JSON.parse(curationEvent.data.output),
      );
      if (curation.status !== "ok") throw new Error(curation.reason);
      const saved = (await listLibrary(LIBRARY_EVAL_USER_ID)).items.filter(
        (item) => item.link === LINK,
      );

      t.succeeded();
      t.noFailedActions();
      t.calledSubagent("link_curator", { count: 1 });
      t.calledTool("save_library_link", { count: 1, input: { link: LINK } });
      t.check(
        firstSave.input,
        equals({
          link: LINK,
          title: curation.title,
          description: curation.description,
          note: curation.note,
          tags: curation.tags,
        }),
      ).label("curator handoff");
      t.check(first.message, equals("✅")).label("first confirmation");
      t.check(second.message, equals("✅")).label("duplicate confirmation");
      t.check(saved.length, equals(1)).label("saved links");
      t.check(
        libraryItemSchema.safeParse({
          ...saved[0],
          note: saved[0]?.note ?? undefined,
        }).success,
        equals(true),
      ).label("saved metadata");
    } finally {
      await prisma.libraryItem.deleteMany({
        where: { userId: LIBRARY_EVAL_USER_ID, link: LINK },
      });
    }
  },
});
