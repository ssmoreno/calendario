import { defineTool } from "eve/tools";

import { libraryLinkItemSchema } from "../../src/library/types";
import { saveLibraryItem } from "../../src/server/library-store";
import { recordLibrarySave } from "../../src/server/whatsapp-inbound-store";
import { maybeThreadId, requireUserId } from "../lib/auth";

export default defineTool({
  description:
    "Save one link after link_curator has returned a grounded title, description, note, and broad tags. Exact duplicate links are treated as already saved.",
  inputSchema: libraryLinkItemSchema,
  execute: async (input, ctx) => {
    const result = await saveLibraryItem(requireUserId(ctx), input);
    const threadId = maybeThreadId(ctx);
    if (threadId) await recordLibrarySave(threadId);
    return result.created
      ? { saved: result.item }
      : { alreadySaved: result.item };
  },
});
