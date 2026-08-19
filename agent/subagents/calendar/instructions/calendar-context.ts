import { defineDynamic, defineInstructions } from "eve/instructions";

import { buildCalendarContext } from "../../../../src/eve/calendar-context";
import { getUserSettings } from "../../../../src/server/settings-store";
import { maybeUserId } from "../../../lib/auth";

export default defineDynamic({
  events: {
    "turn.started": async (_event, ctx) => {
      const userId = maybeUserId(ctx);
      if (!userId) return null;
      const { timeZone } = await getUserSettings(userId);
      return defineInstructions({ content: buildCalendarContext(timeZone) });
    },
  },
});
