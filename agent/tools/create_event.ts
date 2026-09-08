import { defineTool } from "eve/tools";

import { calendarToolMetadata } from "../lib/calendar-tool-metadata";
import { runCalendar } from "../lib/calendar";

const metadata = calendarToolMetadata.createEvent;

export default defineTool({
  description: metadata.description,
  inputSchema: metadata.inputSchema,
  execute: (input, ctx) =>
    runCalendar(ctx, (tools) => tools.createEvent.run(input)),
});
