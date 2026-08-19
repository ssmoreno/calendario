import { defineTool } from "eve/tools";
import { z } from "zod";

import { savedItemKindSchema } from "../../../../src/library/types";
import { listSavedItems } from "../../../../src/server/saved-item-store";
import { requireUserId } from "../../../lib/auth";

export default defineTool({
  description:
    "Read what the user has saved, newest first. Call this before answering any question about their saved links, and before forget_saved to get the right id. The query searches the user's own note, the page title and description, and the site.",
  inputSchema: z.object({
    query: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        'Words to search for, e.g. "pasta" or "nytimes". Omit to list everything.',
      ),
    kind: savedItemKindSchema
      .optional()
      .describe(
        "Limit to one category. Omit unless the user names one, so a vague request still finds the item.",
      ),
  }),
  async execute({ query, kind }, ctx) {
    return { items: await listSavedItems(requireUserId(ctx), { query, kind }) };
  },
});
