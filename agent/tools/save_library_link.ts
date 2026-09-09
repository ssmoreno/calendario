import { defineTool } from "eve/tools";

import { libraryItemSchema } from "../../src/library/types";
import { saveLibraryItem } from "../../src/server/library-store";
import { requireUserId } from "../lib/auth";

export default defineTool({
  description:
    "Save one link after link_curator has returned a grounded title, description, and broad tags. Exact duplicate links are treated as already saved.",
  inputSchema: libraryItemSchema,
  execute: async (input, ctx) => {
    const result = await saveLibraryItem(requireUserId(ctx), input);
    return result.created
      ? { saved: result.item }
      : { alreadySaved: result.item };
  },
});
