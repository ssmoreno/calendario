import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";

import { deleteLibraryItemSchema } from "../../src/library/types";
import { deleteLibraryItem } from "../../src/server/library-store";
import { requireUserId } from "../lib/auth";

export default defineTool({
  description:
    "Delete one library item after resolving its exact item ID with list_library_items.",
  inputSchema: deleteLibraryItemSchema,
  approval: always(),
  execute: ({ itemId }, ctx) =>
    deleteLibraryItem(requireUserId(ctx), itemId),
});
