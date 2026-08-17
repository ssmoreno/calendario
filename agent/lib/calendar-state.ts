import { defineState } from "eve/context";

import {
  changeCalendarTimeZone,
  createCalendarSessionRuntime,
  initialCalendarSessionState,
  type CalendarSessionState,
} from "../../src/eve/calendar-session";
import type { EveTools } from "../../src/eve/tools";

export type { CalendarSessionState } from "../../src/eve/calendar-session";

export const calendarState = defineState<CalendarSessionState>(
  "calendario.calendar",
  initialCalendarSessionState,
);

function toolsFor(state: CalendarSessionState): EveTools {
  return createCalendarSessionRuntime(state).tools;
}

export function readCalendar<Result>(
  read: (tools: EveTools) => Result,
): Result {
  return read(toolsFor(calendarState.get()));
}

export function updateCalendar<Result>(
  update: (tools: EveTools) => Result,
): Result {
  let result: Result | undefined;
  let completed = false;
  calendarState.update((current) => {
    const { engine, tools } = createCalendarSessionRuntime(current);
    result = update(tools);
    completed = true;
    return { ...current, document: engine.getDocument() };
  });
  if (!completed) throw new Error("The calendar update did not complete.");
  return result as Result;
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
