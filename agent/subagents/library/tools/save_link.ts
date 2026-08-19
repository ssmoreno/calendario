import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  savedItemKindSchema,
  savedItemUrlSchema,
  savedNoteSchema,
} from "../../../../src/library/types";
import { fetchLinkMetadata } from "../../../../src/server/link-metadata";
import { saveItem } from "../../../../src/server/saved-item-store";
import { requireUserId } from "../../../lib/auth";

export default defineTool({
  description:
    "Save a link the user wants to come back to later. The page is read for its own title and description, so pass the URL exactly as the user sent it. Saving a link the user already has updates it instead of adding a second copy.",
  inputSchema: z.object({
    url: savedItemUrlSchema.describe("The full http or https link, exactly as the user sent it."),
    kind: savedItemKindSchema
      .default("link")
      .describe(
        'What kind of thing it is: "recipe" to cook, "article" to read, "video" to watch, or "link" when it is none of those.',
      ),
    note: savedNoteSchema
      .optional()
      .describe(
        'What the user said about it, in their own words, e.g. "for sunday dinner". Omit when they said nothing.',
      ),
  }),
  async execute({ url, kind, note }, ctx) {
    const userId = requireUserId(ctx);
    const { title, summary } = await fetchLinkMetadata(url);
    return {
      saved: await saveItem(userId, {
        url,
        kind,
        note: note ?? null,
        title,
        summary,
      }),
    };
  },
});
