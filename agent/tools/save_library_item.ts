import { defineTool } from "eve/tools";

import { libraryAgentItemSchema } from "../../src/library/types";
import { saveLibraryItem } from "../../src/server/library-store";
import { recordLibrarySave } from "../../src/server/whatsapp-inbound-store";
import { maybeThreadId, requireUserId } from "../lib/auth";

export default defineTool({
  description:
    "Save one note or identified subject, including a book, album, recipe, image, or PDF. A Book may link to its Amazon page and Music to its Spotify page; everything else keeps no link. Never store an attachment path or fabricate a link.",
  inputSchema: libraryAgentItemSchema,
  execute: async (input, ctx) => {
    const result = await saveLibraryItem(requireUserId(ctx), input, {
      dedupeByTitle: true,
    });
    const threadId = maybeThreadId(ctx);
    if (threadId) await recordLibrarySave(threadId);
    return { saved: result.item };
  },
});
