import { defineDynamic, defineInstructions } from "eve/instructions";

import { listMemories } from "../../../../src/server/memory-store";
import { getUserSettings } from "../../../../src/server/settings-store";
import { buildUserContext } from "../../../../src/eve/user-context";
import { maybeUserId } from "../../../lib/auth";

export default defineDynamic({
  events: {
    "turn.started": async (_event, ctx) => {
      const userId = maybeUserId(ctx);
      if (!userId) return null;
      const [settings, memories] = await Promise.all([
        getUserSettings(userId),
        listMemories(userId),
      ]);
      return defineInstructions({
        content: buildUserContext(settings, memories),
        role: "user",
      });
    },
  },
});
