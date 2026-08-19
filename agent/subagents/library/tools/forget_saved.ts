import { defineTool } from "eve/tools";
import { z } from "zod";

import { removeSavedItem } from "../../../../src/server/saved-item-store";
import { requireUserId } from "../../../lib/auth";

export default defineTool({
  description:
    "Remove one saved link. Resolve the item with list_saved first and pass its id exactly; this cannot be undone.",
  inputSchema: z.object({
    itemId: z
      .string()
      .min(1)
      .describe("The id of the saved item, exactly as returned by list_saved."),
  }),
  async execute({ itemId }, ctx) {
    return { deleted: await removeSavedItem(requireUserId(ctx), itemId) };
  },
});
