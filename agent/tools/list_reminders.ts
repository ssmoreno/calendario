import { defineTool } from "eve/tools";
import { z } from "zod";

import { listReminders } from "../../src/server/reminder-store";
import { requireUserId } from "../lib/auth";

export default defineTool({
  description:
    "List the reminders SS still owes the user, soonest first. Use this to answer questions about pending reminders and to get an exact reminder ID before cancelling one.",
  inputSchema: z.object({}),
  execute: async (_input, ctx) => ({
    reminders: await listReminders(requireUserId(ctx)),
  }),
});
