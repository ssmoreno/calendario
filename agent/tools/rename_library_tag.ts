import { defineTool } from "eve/tools";

import { renameLibraryTagSchema } from "../../src/library/types";
import { renameLibraryTag } from "../../src/server/library-store";
import { requireUserId } from "../lib/auth";

export default defineTool({
  description:
    "Rename one library tag after resolving its exact tag ID with list_library_tags. Every tagged item reflects the new name.",
  inputSchema: renameLibraryTagSchema,
  execute: ({ tagId, name }, ctx) =>
    renameLibraryTag(requireUserId(ctx), tagId, name),
});
