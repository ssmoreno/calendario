import { defineTool } from "eve/tools";

import { libraryAttachmentItemSchema } from "../../src/library/types";
import { saveLibraryItem } from "../../src/server/library-store";
import { requireUserId } from "../lib/auth";

export default defineTool({
  description:
    "Save one useful library item derived from a user-supplied image or PDF. Store the understood subject and standalone read, never the attachment or a fabricated link.",
  inputSchema: libraryAttachmentItemSchema,
  execute: async (input, ctx) => {
    const result = await saveLibraryItem(requireUserId(ctx), input, {
      dedupeUnlinkedByTitle: true,
    });
    return { saved: result.item };
  },
});
