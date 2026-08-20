import {
  addDays,
  dateRange,
  daysBetween,
  localDateTimeToZoned,
  timingDateKeys,
  zonedTimestampParts,
} from "./date-time";
import { messages } from "./messages";
import { RRule, type Options } from "./rrule-package";
import type {
  CalendarRange,
  EventRecord,
  EventTiming,
  Occurrence,
} from "./types";

function fakeUtcDate(parts: {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
}): Date {
  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour ?? 0,
      parts.minute ?? 0,
      parts.second ?? 0,
    ),
  );
}

function fakeDateFromDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return fakeUtcDate({ year, month, day });
}

function fakeStartForEvent(event: EventRecord): Date {
  if (event.timing.kind === "all-day") {
    return fakeDateFromDateKey(event.timing.startDate);
  }
  return fakeUtcDate(zonedTimestampParts(event.timing.startsAt));
}

function dateKeyFromFake(date: Date): string {
  return `${String(date.getUTCFullYear()).padStart(4, "0")}-${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function timingAtRecurrence(event: EventRecord, date: Date): EventTiming {
  if (event.timing.kind === "all-day") {
    const startDate = dateKeyFromFake(date);
    const durationDays = dateRange(
      event.timing.startDate,
      event.timing.endDateExclusive,
    ).length;
    return {
      kind: "all-day",
      startDate,
      endDateExclusive: addDays(startDate, durationDays),
    };
  }

  const original = zonedTimestampParts(event.timing.startsAt);
  const startDate = dateKeyFromFake(date);
  const startTime = `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes(),
  ).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}`;
  return {
    kind: "timed",
    startsAt: localDateTimeToZoned(startDate, startTime, original.timeZone),
    durationMinutes: event.timing.durationMinutes,
  };
}

export function recurrenceStart(event: EventRecord): string {
  return event.timing.kind === "timed"
    ? event.timing.startsAt
    : event.timing.startDate;
}

function buildOccurrence(
  event: EventRecord,
  timing: EventTiming,
  occurrenceStart: string,
  viewerTimeZone: string,
): Occurrence {
  return {
    key: `${event.id}:${occurrenceStart}`,
    eventId: event.id,
    rootEventId: event.seriesId ?? event.id,
    rootHasRecurrenceExceptions:
      (event.recurrence?.excludedStarts.length ?? 0) > 0,
    rootTiming: event.timing,
    occurrenceStart,
    record: event,
    timing,
    dateKeys: timingDateKeys(timing, viewerTimeZone),
    isOverride: Boolean(event.seriesId),
  };
}

function intersectsRange(occurrence: Occurrence, range: CalendarRange): boolean {
  return occurrence.dateKeys.some(
    (dateKey) => dateKey >= range.from && dateKey <= range.to,
  );
}

function recurrenceLookbackDays(event: EventRecord): number {
  if (event.timing.kind === "all-day") {
    return Math.max(
      2,
      daysBetween(event.timing.startDate, event.timing.endDateExclusive) + 1,
    );
  }
  return Math.max(2, Math.ceil(event.timing.durationMinutes / 1_440) + 2);
}

export function expandEvent(
  event: EventRecord,
  range: CalendarRange,
  viewerTimeZone: string,
): Occurrence[] {
  if (!event.recurrence || event.seriesId) {
    const start = recurrenceStart(event);
    const occurrence = buildOccurrence(
      event,
      event.timing,
      event.originalStart ?? start,
      viewerTimeZone,
    );
    return intersectsRange(occurrence, range) ? [occurrence] : [];
  }

  const options = RRule.parseString(
    event.recurrence.rrule.replace(/^RRULE:/, ""),
  );
  const dtstart = fakeStartForEvent(event);
  const rule = new RRule({ ...options, dtstart });
  const after = new Date(
    fakeDateFromDateKey(range.from).getTime() -
      recurrenceLookbackDays(event) * 86_400_000,
  );
  const before = new Date(
    fakeDateFromDateKey(addDays(range.to, 1)).getTime() + 172_800_000,
  );

  return rule
    .between(after, before, true)
    .map((date) => {
      const timing = timingAtRecurrence(event, date);
      const occurrenceStart =
        timing.kind === "timed" ? timing.startsAt : timing.startDate;
      return buildOccurrence(event, timing, occurrenceStart, viewerTimeZone);
    })
    .filter(
      (occurrence) =>
        !event.recurrence?.excludedStarts.includes(
          occurrence.occurrenceStart,
        ) && intersectsRange(occurrence, range),
    );
}

function ruleOnly(options: Partial<Options>): string {
  return RRule.optionsToString({ ...options, dtstart: null }).replace(
    /^RRULE:/,
    "",
  );
}

export function truncateRuleBefore(
  rrule: string,
  event: EventRecord,
  occurrenceStart: string,
): { originalRule: string | null; followingRule: string } {
  const parsed = RRule.parseString(rrule.replace(/^RRULE:/, ""));
  const dtstart = fakeStartForEvent(event);
  const target =
    event.timing.kind === "timed"
      ? fakeUtcDate(zonedTimestampParts(occurrenceStart))
      : fakeDateFromDateKey(occurrenceStart);

  if (parsed.count) {
    const fullRule = new RRule({ ...parsed, dtstart });
    const beforeCount = fullRule
      .between(dtstart, target, true)
      .filter((date) => date < target).length;
    const remainingCount = Math.max(parsed.count - beforeCount, 1);
    return {
      originalRule:
        beforeCount > 0
          ? ruleOnly({ ...parsed, count: beforeCount, until: null })
          : null,
      followingRule: ruleOnly({
        ...parsed,
        count: remainingCount,
        until: null,
      }),
    };
  }

  return {
    originalRule:
      target > dtstart
        ? ruleOnly({
            ...parsed,
            count: null,
            until: new Date(target.getTime() - 1_000),
          })
        : null,
    followingRule: ruleOnly({ ...parsed, dtstart: null }),
  };
}

export function recurrenceDescription(rrule: string): string {
  try {
    const description = RRule.fromString(
      rrule.replace(/^RRULE:/, ""),
    ).toText();
    return description.charAt(0).toUpperCase() + description.slice(1);
  } catch {
    return messages.domain.repeats;
  }
}

export function eventStartSortValue(occurrence: Occurrence): number {
  if (occurrence.timing.kind === "all-day") return Number.NEGATIVE_INFINITY;
  return new Date(occurrence.timing.startsAt.split("[")[0]).getTime();
}
