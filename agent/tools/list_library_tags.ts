import { defineTool } from "eve/tools";
import { z } from "zod";

import { listLibraryTags } from "../../src/server/library-store";
import { requireUserId } from "../lib/auth";

export default defineTool({
  description:
    "List the user's library tags with their exact IDs and item counts. Use this before renaming or deleting a tag.",
  inputSchema: z.object({}),
  execute: (_input, ctx) => listLibraryTags(requireUserId(ctx)),
});
