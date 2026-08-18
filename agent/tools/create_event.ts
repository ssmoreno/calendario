import { defineTool } from "eve/tools";

import { calendarToolMetadata } from "../lib/calendar-tool-metadata";
import { updateCalendar } from "../lib/calendar-state";
import { eventDefaultsFor } from "../lib/user-settings";

const metadata = calendarToolMetadata.createEvent;

export default defineTool({
  description: metadata.description,
  inputSchema: metadata.inputSchema,
  execute: async (input, ctx) => {
    const defaults = await eventDefaultsFor(ctx);
    return updateCalendar((tools) => tools.createEvent.run(input), defaults);
  },
});
