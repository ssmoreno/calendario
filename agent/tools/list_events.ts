import { defineTool } from "eve/tools";

import { calendarToolMetadata } from "../lib/calendar-tool-metadata";
import { readCalendar } from "../lib/calendar-state";

const metadata = calendarToolMetadata.listEvents;

export default defineTool({
  description: metadata.description,
  inputSchema: metadata.inputSchema,
  execute: (input) => readCalendar((tools) => tools.listEvents.run(input)),
});
