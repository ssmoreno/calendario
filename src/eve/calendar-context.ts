import { todayKey } from "@/calendar/date-time";

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
  timeZone: string | null,
  now = new Date(),
): string {
  if (!timeZone) {
    return "The user's timezone is not configured. If a device timezone is reported in the conversation context, call set_time_zone with it immediately, without asking. Otherwise ask for their location or IANA timezone, then call set_time_zone.";
  }
  const current = currentCalendarTime(timeZone, now);
  return `Today is ${current.weekday}, ${current.today}, and the local time is ${current.localTime} in ${current.timeZone}. Resolve relative dates and times against this context.`;
}
