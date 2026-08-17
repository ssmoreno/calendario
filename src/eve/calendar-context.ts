import { todayKey } from "@/calendar/date-time";

import type { CalendarSessionState } from "./calendar-session";

export interface CurrentCalendarTime {
  timeZone: string;
  today: string;
  weekday: string;
  localTime: string;
}

export function currentCalendarTime(
  timeZone: string,
  now = new Date(),
): CurrentCalendarTime {
  return {
    timeZone,
    today: todayKey(timeZone, now),
    weekday: new Intl.DateTimeFormat("en", {
      weekday: "long",
      timeZone,
    }).format(now),
    localTime: new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
      timeZone,
    }).format(now),
  };
}

export function buildCalendarContext(
  state: CalendarSessionState,
  now = new Date(),
): string {
  if (!state.timeZone) {
    return "The user's timezone is not configured. Before interpreting dates or times or using a calendar tool, ask for their location or IANA timezone, then call set_time_zone.";
  }
  const current = currentCalendarTime(state.timeZone, now);
  return `Today is ${current.weekday}, ${current.today}, and the local time is ${current.localTime} in ${current.timeZone}. Resolve relative dates and times against this context.`;
}
