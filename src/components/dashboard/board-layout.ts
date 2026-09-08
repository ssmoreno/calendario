import { dateKeyInTimeZone, todayKey } from "@/calendar/date-time";
import type { UpcomingEvent } from "@/server/google-calendar";

export interface DaySection {
  dateKey: string;
  events: UpcomingEvent[];
}

function dayKeyFor(event: UpcomingEvent, timeZone: string, today: string) {
  if (event.timing.kind === "all-day") {
    return event.timing.startDate < today ? today : event.timing.startDate;
  }
  return dateKeyInTimeZone(new Date(event.timing.startsAt), timeZone);
}

export function groupByDay(
  events: readonly UpcomingEvent[],
  timeZone: string,
  now = new Date(),
): DaySection[] {
  const today = todayKey(timeZone, now);
  const byDay = new Map<string, UpcomingEvent[]>();

  for (const event of events) {
    const key = dayKeyFor(event, timeZone, today);
    const day = byDay.get(key);
    if (day) day.push(event);
    else byDay.set(key, [event]);
  }

  return [...byDay.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([dateKey, dayEvents]) => ({
      dateKey,
      events: [
        ...dayEvents.filter((event) => event.timing.kind === "all-day"),
        ...dayEvents.filter((event) => event.timing.kind !== "all-day"),
      ],
    }));
}
