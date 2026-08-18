export interface CalendarSessionState {
  timeZone: string | null;
}

export function initialCalendarSessionState(): CalendarSessionState {
  return { timeZone: null };
}

export function changeCalendarTimeZone(
  state: CalendarSessionState,
  timeZone: string,
): CalendarSessionState {
  return { ...state, timeZone };
}
