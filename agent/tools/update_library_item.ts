import { defineTool } from "eve/tools";

import { updateLibraryItemSchema } from "../../src/library/types";
import { updateLibraryItem } from "../../src/server/library-store";
import { requireUserId } from "../lib/auth";

export default defineTool({
  description:
    "Update one library item's title, description, summary, link, or complete tag set after resolving its exact item ID with list_library_items.",
  inputSchema: updateLibraryItemSchema,
  execute: ({ itemId, changes }, ctx) =>
    updateLibraryItem(requireUserId(ctx), itemId, changes),
});
