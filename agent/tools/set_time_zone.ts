import { defineTool } from "eve/tools";

import { currentCalendarTime } from "../../src/eve/calendar-context";
import { timeZoneSchema } from "../../src/eve/time-zone";
import { setCalendarTimeZone } from "../lib/calendar-state";

export default defineTool({
  description:
    "Save the user's IANA timezone for this session. Call after the user provides a timezone or a location that you can unambiguously map to one.",
  inputSchema: timeZoneSchema,
  execute: ({ timeZone }) => {
    setCalendarTimeZone(timeZone);
    return currentCalendarTime(timeZone);
  },
});
