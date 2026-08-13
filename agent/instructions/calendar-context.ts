import { defineDynamic, defineInstructions } from "eve/instructions";

import { buildCalendarContext } from "../../src/eve/calendar-context";
import { calendarState } from "../lib/calendar-state";

export default defineDynamic({
  events: {
    "turn.started": () =>
      defineInstructions({
        content: buildCalendarContext(calendarState.get()),
      }),
  },
});
