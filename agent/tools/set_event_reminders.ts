import { defineTool } from "eve/tools";

import { calendarToolMetadata } from "../lib/calendar-tool-metadata";
import { updateCalendar } from "../lib/calendar-state";

const metadata = calendarToolMetadata.setEventReminders;

export default defineTool({
  description: metadata.description,
  inputSchema: metadata.inputSchema,
  execute: (input) =>
    updateCalendar((tools) => tools.setEventReminders.run(input)),
});
