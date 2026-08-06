import { RRule } from "rrule";
import { z } from "zod";

import { EVENT_COLORS } from "./types";
import { daysBetween, isDateKey, isTimeZone, isZonedTimestamp } from "./date-time";
import { messages } from "./messages";

const timedSchema = z.object({
  kind: z.literal("timed"),
  startsAt: z
    .string()
    .refine(isZonedTimestamp, messages.validation.timezoneAwareStart),
  durationMinutes: z.number().int().positive().max(525_600),
});

const allDaySchema = z
  .object({
    kind: z.literal("all-day"),
    startDate: z.string().refine(isDateKey, messages.validation.dateKey),
    endDateExclusive: z
      .string()
      .refine(isDateKey, messages.validation.dateKey),
  })
  .refine(
    ({ startDate, endDateExclusive }) =>
      daysBetween(startDate, endDateExclusive) > 0,
    { message: messages.validation.allDayEnd },
  );

export const eventTimingSchema = z.discriminatedUnion("kind", [
  timedSchema,
  allDaySchema,
]);

function isRRule(value: string): boolean {
  try {
    const source = value.replace(/^RRULE:/, "");
    RRule.parseString(source);
    return /(^|;)FREQ=/.test(source);
  } catch {
    return false;
  }
}

export const recurrenceSchema = z.object({
  rrule: z.string().refine(isRRule, messages.validation.recurrenceRule),
  excludedStarts: z.array(z.string()),
});

const eventFields = {
  title: z.string().trim().min(1, messages.validation.title).max(160),
  timing: eventTimingSchema,
  recurrence: recurrenceSchema.nullable(),
  location: z.string().trim().max(240).optional(),
  notes: z.string().trim().max(10_000).optional(),
  color: z.enum(EVENT_COLORS),
  reminderMinutesBefore: z.number().int().nonnegative().max(40_320).optional(),
};

function recurrenceEndsAfterStart(value: {
  timing: z.infer<typeof eventTimingSchema>;
  recurrence: z.infer<typeof recurrenceSchema> | null;
}): boolean {
  if (!value.recurrence) return true;
  const until = value.recurrence.rrule.match(
    /(?:^|;)UNTIL=(\d{4})(\d{2})(\d{2})/,
  );
  if (!until) return true;
  const endDate = `${until[1]}-${until[2]}-${until[3]}`;
  const startDate =
    value.timing.kind === "all-day"
      ? value.timing.startDate
      : value.timing.startsAt.slice(0, 10);
  return endDate >= startDate;
}

function recurrenceExclusionsMatchTiming(value: {
  timing: z.infer<typeof eventTimingSchema>;
  recurrence: z.infer<typeof recurrenceSchema> | null;
}): boolean {
  if (!value.recurrence) return true;
  const isValidStart =
    value.timing.kind === "timed" ? isZonedTimestamp : isDateKey;
  return value.recurrence.excludedStarts.every(isValidStart);
}

export const eventInputSchema = z
  .object(eventFields)
  .refine(recurrenceEndsAfterStart, {
    message: messages.validation.recurrenceEnd,
    path: ["recurrence", "rrule"],
  })
  .refine(recurrenceExclusionsMatchTiming, {
    message: messages.validation.recurrenceExclusions,
    path: ["recurrence", "excludedStarts"],
  });

export const eventRecordSchema = z
  .object({
    id: z.string().min(1),
    ...eventFields,
    seriesId: z.string().min(1).optional(),
    originalStart: z.string().min(1).optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .refine(recurrenceEndsAfterStart, {
    message: messages.validation.recurrenceEnd,
    path: ["recurrence", "rrule"],
  })
  .refine(recurrenceExclusionsMatchTiming, {
    message: messages.validation.recurrenceExclusions,
    path: ["recurrence", "excludedStarts"],
  });

export const calendarDocumentSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime(),
  events: z.array(eventRecordSchema),
});

export const preferencesDocumentSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  theme: z.enum(["system", "light", "dark"]),
});

export const importSchema = z.union([
  calendarDocumentSchema,
  z.object({
    calendar: calendarDocumentSchema,
    exportedAt: z.iso.datetime().optional(),
  }),
]);

export const timeZoneSchema = z.string().refine(isTimeZone);
