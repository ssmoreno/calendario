import {
  fromDate,
  parseDate,
  parseDateTime,
  parseZonedDateTime,
  toZoned,
} from "@internationalized/date";

import type { EventTiming } from "./types";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: string): boolean {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  try {
    return parseDate(value).toString() === value;
  } catch {
    return false;
  }
}

export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function isZonedTimestamp(value: string): boolean {
  try {
    parseZonedDateTime(value);
    return true;
  } catch {
    return false;
  }
}

export function localDateTimeToZoned(
  dateKey: string,
  time: string,
  timeZone: string,
): string {
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  return toZoned(
    parseDateTime(`${dateKey}T${normalizedTime}`),
    timeZone,
    "compatible",
  ).toString();
}

export function zonedTimestampToDate(value: string): Date {
  return parseZonedDateTime(value).toDate();
}

export function zonedTimestampParts(value: string) {
  const parsed = parseZonedDateTime(value);
  return {
    year: parsed.year,
    month: parsed.month,
    day: parsed.day,
    hour: parsed.hour,
    minute: parsed.minute,
    second: parsed.second,
    timeZone: parsed.timeZone,
  };
}

export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  const zoned = fromDate(date, timeZone);
  return [zoned.year, zoned.month, zoned.day]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0"))
    .join("-");
}

export function todayKey(timeZone: string, now = new Date()): string {
  return dateKeyInTimeZone(now, timeZone);
}

export function addDays(dateKey: string, days: number): string {
  return parseDate(dateKey).add({ days }).toString();
}

export function daysBetween(from: string, to: string): number {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(toYear, toMonth - 1, toDay) -
      Date.UTC(fromYear, fromMonth - 1, fromDay)) /
      86_400_000,
  );
}

export function dateRange(
  startInclusive: string,
  endExclusive: string,
): string[] {
  const dates: string[] = [];
  for (
    let cursor = startInclusive;
    cursor < endExclusive;
    cursor = addDays(cursor, 1)
  ) {
    dates.push(cursor);
  }
  return dates;
}

export function monthRange(dateKey: string): { from: string; to: string } {
  const from = `${dateKey.slice(0, 7)}-01`;
  const nextMonth = parseDate(from).add({ months: 1 }).toString();
  return { from, to: addDays(nextMonth, -1) };
}

export function timingDateKeys(
  timing: EventTiming,
  viewerTimeZone: string,
): string[] {
  if (timing.kind === "all-day") {
    return dateRange(timing.startDate, timing.endDateExclusive);
  }

  const start = zonedTimestampToDate(timing.startsAt);
  const endExclusive = new Date(
    start.getTime() + timing.durationMinutes * 60_000,
  );
  const first = dateKeyInTimeZone(start, viewerTimeZone);
  const last = dateKeyInTimeZone(
    new Date(Math.max(start.getTime(), endExclusive.getTime() - 1)),
    viewerTimeZone,
  );
  return dateRange(first, addDays(last, 1));
}

export function formatDateKey(
  dateKey: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function formatTime(
  startsAt: string,
  locale: string,
  viewerTimeZone: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: viewerTimeZone,
  }).format(zonedTimestampToDate(startsAt));
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes >= 1_440) {
    const days = Math.floor(minutes / 1_440);
    const remainder = minutes % 1_440;
    const dayLabel = `${days} ${days === 1 ? "day" : "days"}`;
    return remainder ? `${dayLabel} ${formatDuration(remainder)}` : dayLabel;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

export function timeValueFromZoned(value: string): string {
  const { hour, minute } = zonedTimestampParts(value);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function dateValueFromZoned(value: string): string {
  const { year, month, day } = zonedTimestampParts(value);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function timezoneFromZoned(value: string): string {
  return zonedTimestampParts(value).timeZone;
}
