import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";

import { deleteLibraryTagSchema } from "../../src/library/types";
import { deleteLibraryTag } from "../../src/server/library-store";
import { requireUserId } from "../lib/auth";

export default defineTool({
  description:
    "Delete one library tag after resolving its exact tag ID with list_library_tags. This removes the tag from every item but does not delete any item.",
  inputSchema: deleteLibraryTagSchema,
  approval: always(),
  execute: ({ tagId }, ctx) =>
    deleteLibraryTag(requireUserId(ctx), tagId),
});
