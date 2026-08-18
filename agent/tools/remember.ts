import { defineTool } from "eve/tools";
import { z } from "zod";

import { memoryContentSchema } from "../../src/calendar/settings";
import { addMemory } from "../../src/server/memory-store";
import { requireUserId } from "../lib/auth";

export default defineTool({
  description:
    "Save one durable fact or preference about the user so it is available in every future conversation. Use it for things that will still be true next month, not for one-off scheduling details. Never save passwords, codes, card numbers, or anything else secret.",
  inputSchema: z.object({
    content: memoryContentSchema.describe(
      "One short, self-contained fact in plain language, e.g. \"Prefers to keep Friday afternoons free\".",
    ),
  }),
  async execute({ content }, ctx) {
    return { memory: await addMemory(requireUserId(ctx), content) };
  },
});
