import { defineState } from "eve/context";

export const calendarTimeZone = defineState<string | null>(
  "calendario.calendar-time-zone",
  () => null,
);
