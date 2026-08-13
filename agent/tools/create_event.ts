import { defineTool } from "eve/tools";

import { calendarToolMetadata } from "../lib/calendar-tool-metadata";
import { updateCalendar } from "../lib/calendar-state";

const metadata = calendarToolMetadata.createEvent;

export default defineTool({
  description: metadata.description,
  inputSchema: metadata.inputSchema,
  execute: (input) => updateCalendar((tools) => tools.createEvent.run(input)),
});
