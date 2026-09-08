import { defineTool } from "eve/tools";

import { currentCalendarTime } from "../../src/eve/calendar-context";
import { setTimeZoneSchema } from "../../src/eve/time-zone";
import { calendarTimeZone } from "../lib/calendar-time-zone";

export default defineTool({
  description:
    "Set the IANA timezone for this calendar conversation. Call before any calendar tool, using the device timezone from client context unless the user explicitly names another timezone.",
  inputSchema: setTimeZoneSchema,
  execute({ timeZone }) {
    calendarTimeZone.update(() => timeZone);
    return currentCalendarTime(timeZone);
  },
});
