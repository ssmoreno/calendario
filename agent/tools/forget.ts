import { defineTool } from "eve/tools";
import { z } from "zod";

import { removeMemory } from "../../src/server/memory-store";
import { requireUserId } from "../lib/auth";

export default defineTool({
  description:
    "Delete one thing you had saved about the user. Call this when they say something you remember is wrong or no longer applies.",
  inputSchema: z.object({
    memoryId: z
      .string()
      .min(1)
      .describe("The id of the saved memory, exactly as it appears in context."),
  }),
  async execute({ memoryId }, ctx) {
    return { deleted: await removeMemory(requireUserId(ctx), memoryId) };
  },
});
