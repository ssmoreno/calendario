import { defineTool } from "eve/tools";

import { createLibraryTagSchema } from "../../src/library/types";
import { createLibraryTag } from "../../src/server/library-store";
import { requireUserId } from "../lib/auth";

export default defineTool({
  description:
    "Create a user-owned library tag. A case-insensitive duplicate is returned as already existing.",
  inputSchema: createLibraryTagSchema,
  execute: async ({ name }, ctx) => {
    const result = await createLibraryTag(requireUserId(ctx), name);
    return result.created
      ? { created: result.tag }
      : { alreadyExists: result.tag };
  },
});
