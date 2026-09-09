import { defineTool } from "eve/tools";

import { libraryFiltersSchema } from "../../src/library/types";
import { listLibrary } from "../../src/server/library-store";
import { requireUserId } from "../lib/auth";

export default defineTool({
  description:
    "List or search the user's library items. Use this to answer library questions and to get an exact item ID before updating or deleting an item.",
  inputSchema: libraryFiltersSchema,
  execute: (input, ctx) => listLibrary(requireUserId(ctx), input),
});
