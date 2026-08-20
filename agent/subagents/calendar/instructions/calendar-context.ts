import { defineDynamic, defineInstructions } from "eve/instructions";

import { buildCalendarContext } from "../../../../src/eve/calendar-context";
import { buildSettingsContext } from "../../../../src/eve/user-context";
import { getUserSettings } from "../../../../src/server/settings-store";
import { maybeUserId } from "../../../lib/auth";

/**
 * One resolver for everything the specialist needs about the user, so the
 * settings are read once per turn. What Eve remembers about the user stays with
 * Eve: it writes the reply, and nothing here is personalised by it.
 */
export default defineDynamic({
  events: {
    "turn.started": async (_event, ctx) => {
      const userId = maybeUserId(ctx);
      if (!userId) return null;
      const settings = await getUserSettings(userId);
      return defineInstructions({
        content: [
          buildCalendarContext(settings.timeZone),
          buildSettingsContext(settings),
        ].join("\n\n"),
      });
    },
  },
});
