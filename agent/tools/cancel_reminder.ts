import { defineTool } from "eve/tools";

import { cancelReminderSchema } from "../../src/reminders/types";
import { cancelReminder } from "../../src/server/reminder-store";
import { requireUserId } from "../lib/auth";

export default defineTool({
  description:
    "Cancel one pending reminder after resolving its exact ID with list_reminders.",
  inputSchema: cancelReminderSchema,
  execute: async ({ reminderId }, ctx) => ({
    cancelled: await cancelReminder(requireUserId(ctx), reminderId),
  }),
});
