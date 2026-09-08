import { defineDynamic, defineInstructions } from "eve/instructions";

import { buildCalendarContext } from "../../src/eve/calendar-context";
import { calendarTimeZone } from "../lib/calendar-time-zone";

export default defineDynamic({
  events: {
    "turn.started": () =>
      defineInstructions({ content: buildCalendarContext(calendarTimeZone.get()) }),
  },
});
