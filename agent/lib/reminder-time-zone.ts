import { calendarTimeZone } from "./calendar-time-zone";

/**
 * A reminder fires at an absolute instant, so the zone the user's words were
 * resolved in has to be recorded with it. The conversation's zone is the same
 * one the calendar tools already run on.
 */
export function requireTimeZone(): string {
  const timeZone = calendarTimeZone.get();
  if (!timeZone) {
    throw new Error(
      "Call set_time_zone before scheduling a reminder.",
    );
  }
  return timeZone;
}
