import { defineState } from "eve/context";

import {
  changeCalendarTimeZone,
  initialCalendarSessionState,
  type CalendarSessionState,
} from "../../src/eve/calendar-session";
import type { EveTools } from "../../src/eve/tools";
import { createEveTools } from "../../src/eve/tools";
import { googleCalendarForUser } from "../../src/server/google-calendar";
import { requireUserId } from "./auth";
import { eventDefaultsFor } from "./user-settings";

export type { CalendarSessionState } from "../../src/eve/calendar-session";

export const calendarState = defineState<CalendarSessionState>(
  "calendario.calendar",
  initialCalendarSessionState,
);

export async function runCalendar<Result>(
  ctx: Parameters<typeof requireUserId>[0],
  run: (tools: EveTools) => Result | Promise<Result>,
): Promise<Result> {
  const { timeZone } = calendarState.get();
  if (!timeZone) {
    throw new Error(
      "The calendar timezone is not set. Ask the user for their location or IANA timezone, then call set_time_zone.",
    );
  }
  const userId = requireUserId(ctx);
  const [service, defaults] = await Promise.all([
    googleCalendarForUser(userId, timeZone),
    eventDefaultsFor(ctx),
  ]);
  return await run(createEveTools(service, { timeZone, defaults }));
}

export function setCalendarTimeZone(timeZone: string): CalendarSessionState {
  let nextState: CalendarSessionState | undefined;
  calendarState.update((current) => {
    nextState = changeCalendarTimeZone(current, timeZone);
    return nextState;
  });
  if (!nextState) throw new Error("The timezone update did not complete.");
  return nextState;
}
