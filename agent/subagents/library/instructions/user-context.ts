import { defineDynamic, defineInstructions } from "eve/instructions";

import { listMemories } from "../../../../src/server/memory-store";
import { buildMemoryContext } from "../../../../src/eve/user-context";
import { maybeUserId } from "../../../lib/auth";

export default defineDynamic({
  events: {
    "turn.started": async (_event, ctx) => {
      const userId = maybeUserId(ctx);
      if (!userId) return null;
      return defineInstructions({
        content: buildMemoryContext(await listMemories(userId)),
        role: "user",
      });
    },
  },
});
