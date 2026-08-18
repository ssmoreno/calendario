import { defineTool } from "eve/tools";

import { deleteEventApproval } from "../../src/eve/delete-approval";
import { calendarToolMetadata } from "../lib/calendar-tool-metadata";
import { runCalendar } from "../lib/calendar-state";

const metadata = calendarToolMetadata.deleteEvent;

export default defineTool({
  description: metadata.description,
  inputSchema: metadata.inputSchema,
  approval: ({ toolInput }) => deleteEventApproval(toolInput),
  execute: (input, ctx) =>
    runCalendar(ctx, (tools) => tools.deleteEvent.run(input)),
});
