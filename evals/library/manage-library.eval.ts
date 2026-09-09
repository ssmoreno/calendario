import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

import { normalizeLibraryTagName } from "../../src/library/types";
import { prisma } from "../../src/server/db";
import { saveLibraryItem } from "../../src/server/library-store";
import {
  ensureLibraryEvalUser,
  LIBRARY_EVAL_USER_ID,
} from "./helpers";

const LINK = "https://example.com/prisma-agent-management";
const TAG_NAMES = ["Reading List", "To Read", "Reference"];

async function cleanUp() {
  await prisma.libraryItem.deleteMany({
    where: { userId: LIBRARY_EVAL_USER_ID, link: LINK },
  });
  await prisma.libraryTag.deleteMany({
    where: {
      userId: LIBRARY_EVAL_USER_ID,
      normalizedName: {
        in: TAG_NAMES.map(normalizeLibraryTagName),
      },
    },
  });
}

export default defineEval({
  description:
    "The agent creates and renames tags, updates an item, and requests approval before deletions.",
  async test(t) {
    await ensureLibraryEvalUser();
    await cleanUp();

    try {
      const createTag = await t.send(
        "Create a library tag called Reading List.",
      );
      createTag.succeeded();
      createTag.calledTool("create_library_tag", { count: 1 });

      const renameTag = await t.send(
        "Rename the Reading List tag to To Read.",
      );
      renameTag.succeeded();
      renameTag.toolOrder(["list_library_tags", "rename_library_tag"]);

      await saveLibraryItem(LIBRARY_EVAL_USER_ID, {
        title: "Prisma guide",
        description: "Database reference",
        link: LINK,
        tags: ["Reference"],
      });

      const updateItem = await t.send(
        "Change the saved Prisma guide title to Prisma handbook.",
      );
      updateItem.succeeded();
      updateItem.toolOrder(["list_library_items", "update_library_item"]);

      const deleteItem = await t.send(
        "Delete the Prisma handbook from my library.",
      );
      deleteItem.parked();
      deleteItem.calledTool("list_library_items", { count: 1 });
      t.requireInputRequest({ toolName: "delete_library_item" });
      const deletedItem = await t.respondAll("approve");
      deletedItem.succeeded();

      const deleteTag = await t.send("Delete the To Read tag.");
      deleteTag.parked();
      deleteTag.calledTool("list_library_tags", { count: 1 });
      t.requireInputRequest({ toolName: "delete_library_tag" });
      const deletedTag = await t.respondAll("approve");
      deletedTag.succeeded();

      t.noFailedActions();
      t.calledTool("delete_library_item", { count: 1 });
      t.calledTool("delete_library_tag", { count: 1 });
      t.check(
        await prisma.libraryItem.count({
          where: { userId: LIBRARY_EVAL_USER_ID, link: LINK },
        }),
        equals(0),
      ).label("item deleted");
      t.check(
        await prisma.libraryTag.count({
          where: {
            userId: LIBRARY_EVAL_USER_ID,
            normalizedName: normalizeLibraryTagName("To Read"),
          },
        }),
        equals(0),
      ).label("tag deleted");
    } finally {
      await cleanUp();
    }
  },
});
