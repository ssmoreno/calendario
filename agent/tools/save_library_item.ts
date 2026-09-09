import { defineTool } from "eve/tools";

import { libraryAgentItemSchema } from "../../src/library/types";
import { saveLibraryItem } from "../../src/server/library-store";
import { requireUserId } from "../lib/auth";

export default defineTool({
  description:
    "Save one unlinked note or identified subject, including a book, album, recipe, image, or PDF. Never store an attachment path or fabricate a link.",
  inputSchema: libraryAgentItemSchema,
  execute: async (input, ctx) => {
    const result = await saveLibraryItem(requireUserId(ctx), input, {
      dedupeUnlinkedByTitle: true,
    });
    return { saved: result.item };
  },
});
