import { CalendarDocumentEngine } from "@/calendar/calendar-document-engine";
import { emptyCalendar } from "@/calendar/storage";
import type { CalendarDocument } from "@/calendar/types";

import { createEveTools } from "./tools";

export interface CalendarSessionState {
  timeZone: string | null;
  document: CalendarDocument;
}

export function initialCalendarSessionState(): CalendarSessionState {
  return { timeZone: null, document: emptyCalendar() };
}

export function changeCalendarTimeZone(
  state: CalendarSessionState,
  timeZone: string,
): CalendarSessionState {
  return { ...state, timeZone };
}

export function createCalendarSessionRuntime(state: CalendarSessionState) {
  if (!state.timeZone) {
    throw new Error(
      "The calendar timezone is not set. Ask the user for their location or IANA timezone, then call set_time_zone.",
    );
  }
  const engine = new CalendarDocumentEngine(state.document, state.timeZone);
  return {
    engine,
    tools: createEveTools(engine, { timeZone: state.timeZone }),
  };
}
