import {
  addDays,
  dateValueFromZoned,
  daysBetween,
  localDateTimeToZoned,
  timeValueFromZoned,
  timezoneFromZoned,
} from "./date-time";
import type { EventTiming } from "./types";

export function timingAtOccurrence(
  timing: EventTiming,
  occurrenceStart: string,
): EventTiming {
  if (timing.kind === "timed") {
    return { ...timing, startsAt: occurrenceStart };
  }
  const durationDays = Math.max(
    1,
    daysBetween(timing.startDate, timing.endDateExclusive),
  );
  return {
    kind: "all-day",
    startDate: occurrenceStart,
    endDateExclusive: addDays(occurrenceStart, durationDays),
  };
}

export function rebaseSeriesTiming(
  base: EventTiming,
  selected: EventTiming,
  next: EventTiming,
): EventTiming {
  if (base.kind !== next.kind || selected.kind !== next.kind) return next;
  if (
    next.kind === "timed" &&
    base.kind === "timed" &&
    selected.kind === "timed"
  ) {
    if (
      dateValueFromZoned(next.startsAt) !==
      dateValueFromZoned(selected.startsAt)
    ) {
      return next;
    }
    return {
      ...next,
      startsAt: localDateTimeToZoned(
        dateValueFromZoned(base.startsAt),
        timeValueFromZoned(next.startsAt),
        timezoneFromZoned(next.startsAt),
      ),
    };
  }
  if (
    next.kind === "all-day" &&
    base.kind === "all-day" &&
    selected.kind === "all-day"
  ) {
    if (next.startDate !== selected.startDate) return next;
    const durationDays = daysBetween(next.startDate, next.endDateExclusive);
    return {
      ...next,
      startDate: base.startDate,
      endDateExclusive: addDays(base.startDate, durationDays),
    };
  }
  return next;
}
