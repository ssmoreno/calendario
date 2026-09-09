import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

import {
  libraryItemSchema,
  linkCurationSchema,
} from "../../src/library/types";
import { prisma } from "../../src/server/db";

const LINK = "https://example.com/";
const USER_ID = "local-dev";

export default defineEval({
  description:
    "A link is curated by the specialist, saved once, and acknowledged with only a checkmark.",
  async test(t) {
    await prisma.user.upsert({
      where: { id: USER_ID },
      create: {
        id: USER_ID,
        name: "Local dev",
        email: "local-dev@calendario.invalid",
        emailVerified: true,
      },
      update: {},
    });
    await prisma.libraryItem.deleteMany({ where: { userId: USER_ID, link: LINK } });

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
      const saved = await prisma.libraryItem.findMany({
        where: { userId: USER_ID, link: LINK },
      });

      t.succeeded();
      t.noFailedActions();
      t.calledSubagent("link_curator", { count: 2 });
      t.calledTool("save_library_link", { count: 2, input: { link: LINK } });
      t.check(
        firstSave.input,
        equals({
          link: LINK,
          title: curation.title,
          description: curation.description,
          summary: curation.summary,
          tags: curation.tags,
        }),
      ).label("curator handoff");
      t.check(first.message, equals("✅")).label("first confirmation");
      t.check(second.message, equals("✅")).label("duplicate confirmation");
      t.check(saved.length, equals(1)).label("saved links");
      t.check(libraryItemSchema.safeParse(saved[0]).success, equals(true)).label(
        "saved metadata",
      );
    } finally {
      await prisma.libraryItem.deleteMany({ where: { userId: USER_ID, link: LINK } });
    }
  },
});
