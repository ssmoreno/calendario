import { defineTool } from "eve/tools";

import { createReminderSchema } from "../../src/reminders/types";
import { createReminder } from "../../src/server/reminder-store";
import { linkedWaId } from "../../src/server/whatsapp-link-store";
import { requireUserId } from "../lib/auth";
import { requireTimeZone } from "../lib/reminder-time-zone";

export default defineTool({
  description:
    "Schedule a message SS will text the user at a given moment, for anything they asked to be reminded about. This does not touch the calendar: use it for a standalone nudge such as taking food out of the oven, making a call, or running an errand. For a notification attached to a saved event, use update_event or set_event_reminders instead.",
  inputSchema: createReminderSchema,
  execute: async (input, ctx) => {
    const userId = requireUserId(ctx);
    // WhatsApp is the only surface SS can reach unprompted, so a reminder set
    // from an account without one could never be delivered.
    if (!(await linkedWaId(userId))) {
      throw new Error(
        "This account has no WhatsApp connected, so a reminder could not be delivered. Ask them to connect WhatsApp in the web app first.",
      );
    }
    const reminder = await createReminder(userId, input, requireTimeZone());
    return { scheduled: reminder };
  },
});
