import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

import {
  addDays,
  daysBetween,
  isDateKey,
  isTimeZone,
  localDateTimeToZoned,
} from "@/calendar/date-time";
import { EVENT_COLORS } from "@/calendar/types";
import type {
  CalendarService,
  EventPatch,
  EventRecord,
  EventTiming,
  Occurrence,
} from "@/calendar/types";

const MAX_RANGE_DAYS = 366;
const MAX_LISTED_OCCURRENCES = 200;
const NOTES_PREVIEW_LENGTH = 280;

const dateKeySchema = z
  .string()
  .refine(isDateKey, "Use a real calendar date in YYYY-MM-DD format.");

const timedTimingSchema = z.object({
  kind: z.literal("timed"),
  date: dateKeySchema.describe("Start date, YYYY-MM-DD."),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM.")
    .describe("Start time in 24-hour HH:MM, e.g. 09:30 or 17:00."),
  durationMinutes: z
    .number()
    .int()
    .positive()
    .max(525_600)
    .describe(
      "Event length in minutes. If the user gave an end time, convert it to minutes.",
    ),
  timeZone: z
    .string()
    .refine(isTimeZone, "Use an IANA timezone like Europe/Madrid.")
    .optional()
    .describe("IANA timezone of the start time. Omit to use the user's timezone."),
});

const allDayTimingSchema = z.object({
  kind: z.literal("all-day"),
  startDate: dateKeySchema.describe("First day of the event, YYYY-MM-DD."),
  endDate: dateKeySchema
    .optional()
    .describe("Last day of the event, inclusive. Omit for a single-day event."),
});

const timingSchema = z
  .discriminatedUnion("kind", [timedTimingSchema, allDayTimingSchema])
  .describe(
    'Use kind "timed" for events at a clock time and "all-day" for date-only events.',
  );

const rruleSchema = z
  .string()
  .describe(
    'iCalendar RRULE, e.g. "FREQ=DAILY", "FREQ=WEEKLY;BYDAY=MO,WE", "FREQ=MONTHLY;BYMONTHDAY=15". End a series with ;UNTIL=YYYYMMDD or ;COUNT=n.',
  );

const scopeSchema = z
  .enum(["occurrence", "following", "series"])
  .default("occurrence")
  .describe(
    'For repeating events: "occurrence" affects only the one at occurrenceStart, "following" affects it and every later one, "series" affects all of them. Ignored for non-repeating events.',
  );

const targetFields = {
  eventId: z
    .string()
    .min(1)
    .describe("The eventId exactly as returned by list_events."),
  occurrenceStart: z
    .string()
    .min(1)
    .describe("The occurrenceStart exactly as returned by list_events."),
};

function toEventTiming(
  input: z.infer<typeof timingSchema>,
  defaultTimeZone: string,
): EventTiming {
  if (input.kind === "timed") {
    return {
      kind: "timed",
      startsAt: localDateTimeToZoned(
        input.date,
        input.time,
        input.timeZone ?? defaultTimeZone,
      ),
      durationMinutes: input.durationMinutes,
    };
  }
  const lastDay = input.endDate ?? input.startDate;
  if (daysBetween(input.startDate, lastDay) < 0) {
    throw new Error("endDate must be on or after startDate.");
  }
  return {
    kind: "all-day",
    startDate: input.startDate,
    endDateExclusive: addDays(lastDay, 1),
  };
}

function describeTiming(timing: EventTiming) {
  if (timing.kind === "timed") {
    return {
      kind: "timed" as const,
      startsAt: timing.startsAt,
      durationMinutes: timing.durationMinutes,
    };
  }
  return {
    kind: "all-day" as const,
    startDate: timing.startDate,
    lastDay: addDays(timing.endDateExclusive, -1),
  };
}

function notesPreview(notes: string | undefined): string | undefined {
  if (!notes) return undefined;
  if (notes.length <= NOTES_PREVIEW_LENGTH) return notes;
  return `${notes.slice(0, NOTES_PREVIEW_LENGTH - 1)}…`;
}

function describeRecord(record: EventRecord) {
  return {
    eventId: record.id,
    title: record.title,
    timing: describeTiming(record.timing),
    repeats: record.recurrence?.rrule ?? null,
    location: record.location,
    notes: notesPreview(record.notes),
    color: record.color,
    reminderMinutesBefore: record.reminderMinutesBefore,
  };
}

function describeOccurrence(occurrence: Occurrence) {
  return {
    ...describeRecord(occurrence.record),
    eventId: occurrence.eventId,
    occurrenceStart: occurrence.occurrenceStart,
    timing: describeTiming(occurrence.timing),
    isSeriesException: occurrence.isOverride || undefined,
  };
}

function toReadableError(error: unknown): never {
  if (error instanceof z.ZodError) {
    const details = error.issues
      .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid event details — ${details}`);
  }
  throw error;
}

const hasKey = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

export interface EveToolsOptions {
  /** IANA timezone dates, times, and ranges are interpreted in unless a call names another. */
  timeZone: string;
}

/**
 * The tools Eve uses to control a calendar. They bind to the CalendarService
 * interface, so any backend (browser localStorage today, a server store for
 * the WhatsApp channel later) works unchanged. Pass the result to the SDK
 * tool runner as `Object.values(tools)`.
 */
export function createEveTools(
  service: CalendarService,
  { timeZone }: EveToolsOptions,
) {
  const listEvents = betaZodTool({
    name: "list_events",
    description:
      "Read the user's calendar: every event occurrence between two dates, with repeating series expanded and sorted by start. Call this before answering any question about existing plans, and always call it before update_event or delete_event to copy the target's exact eventId and occurrenceStart.",
    inputSchema: z.object({
      from: dateKeySchema.describe(
        "First day of the range, YYYY-MM-DD, in the user's timezone.",
      ),
      to: dateKeySchema.describe("Last day of the range, inclusive, YYYY-MM-DD."),
      query: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe(
          "Case-insensitive text filter over title, location, and notes.",
        ),
    }),
    run: async ({ from, to, query }) => {
      const span = daysBetween(from, to);
      if (span < 0) throw new Error("`to` must be on or after `from`.");
      if (span > MAX_RANGE_DAYS) {
        throw new Error(
          `That range is too wide — request ${MAX_RANGE_DAYS} days or fewer.`,
        );
      }
      const occurrences = await service.listOccurrences({ from, to });
      const needle = query?.toLowerCase();
      const matches = needle
        ? occurrences.filter(({ record }) =>
            [record.title, record.location, record.notes].some((field) =>
              field?.toLowerCase().includes(needle),
            ),
          )
        : occurrences;
      return JSON.stringify({
        range: { from, to },
        count: matches.length,
        ...(matches.length > MAX_LISTED_OCCURRENCES
          ? {
              truncated: `Showing the first ${MAX_LISTED_OCCURRENCES} of ${matches.length} occurrences. Narrow the range or add a query for the rest.`,
            }
          : {}),
        occurrences: matches
          .slice(0, MAX_LISTED_OCCURRENCES)
          .map(describeOccurrence),
      });
    },
  });

  const createEvent = betaZodTool({
    name: "create_event",
    description:
      "Add a new event to the user's calendar. Call when the user wants to schedule, add, book, or block time. Do not use this to change an existing event — use update_event for that.",
    inputSchema: z.object({
      title: z.string().trim().min(1).max(160).describe("Event title."),
      timing: timingSchema,
      rrule: rruleSchema.optional().describe(
        "Include only when the event repeats.",
      ),
      location: z.string().trim().max(240).optional(),
      notes: z.string().trim().max(10_000).optional(),
      color: z
        .enum(EVENT_COLORS)
        .optional()
        .describe("Calendar color. Omit unless the user asks for one."),
      reminderMinutesBefore: z
        .number()
        .int()
        .nonnegative()
        .max(40_320)
        .optional()
        .describe("Minutes before the start to remind, e.g. 0, 15, 60, 1440."),
    }),
    run: async (input) => {
      try {
        const record = await service.createEvent({
          title: input.title,
          timing: toEventTiming(input.timing, timeZone),
          recurrence: input.rrule
            ? { rrule: input.rrule, excludedStarts: [] }
            : null,
          location: input.location,
          notes: input.notes,
          color: input.color ?? "coral",
          reminderMinutesBefore: input.reminderMinutesBefore,
        });
        return JSON.stringify({ created: describeRecord(record) });
      } catch (error) {
        toReadableError(error);
      }
    },
  });

  const updateEvent = betaZodTool({
    name: "update_event",
    description:
      "Change an existing event. First resolve the target with list_events and pass its eventId and occurrenceStart exactly. Include only the fields being changed; omitted fields keep their current value. For repeating events choose scope from the user's wording — if it is unclear whether they mean one occurrence or the whole series, ask before calling.",
    inputSchema: z.object({
      ...targetFields,
      scope: scopeSchema,
      changes: z
        .object({
          title: z.string().trim().min(1).max(160).optional(),
          timing: timingSchema
            .optional()
            .describe(
              "Complete replacement timing. Include every field — durationMinutes too — even when only the time moves.",
            ),
          rrule: rruleSchema
            .nullable()
            .optional()
            .describe(
              'New repeat rule, or null to stop repeating. Include only when the repetition itself changes — replacing the rule resets any "just this one" exceptions in the series.',
            ),
          location: z
            .string()
            .trim()
            .max(240)
            .nullable()
            .optional()
            .describe("New location, or null to clear it."),
          notes: z
            .string()
            .trim()
            .max(10_000)
            .nullable()
            .optional()
            .describe("New notes, or null to clear them."),
          color: z.enum(EVENT_COLORS).optional(),
          reminderMinutesBefore: z
            .number()
            .int()
            .nonnegative()
            .max(40_320)
            .nullable()
            .optional()
            .describe("Minutes before the start, or null to remove the reminder."),
        })
        .describe("Only the fields to change."),
    }),
    run: async ({ eventId, occurrenceStart, scope, changes }) => {
      const patch: EventPatch = {};
      if (changes.title !== undefined) patch.title = changes.title;
      if (changes.timing !== undefined) {
        patch.timing = toEventTiming(changes.timing, timeZone);
      }
      if (hasKey(changes, "rrule")) {
        patch.recurrence =
          changes.rrule == null
            ? null
            : { rrule: changes.rrule, excludedStarts: [] };
      }
      if (hasKey(changes, "location")) patch.location = changes.location ?? undefined;
      if (hasKey(changes, "notes")) patch.notes = changes.notes ?? undefined;
      if (changes.color !== undefined) patch.color = changes.color;
      if (hasKey(changes, "reminderMinutesBefore")) {
        patch.reminderMinutesBefore = changes.reminderMinutesBefore ?? undefined;
      }
      if (Object.keys(patch).length === 0) {
        throw new Error("No changes provided — include at least one field in `changes`.");
      }
      try {
        await service.updateEvent({ eventId, occurrenceStart }, scope, patch);
      } catch (error) {
        toReadableError(error);
      }
      return JSON.stringify({
        updated: { eventId, occurrenceStart, scope, fields: Object.keys(patch) },
      });
    },
  });

  const deleteEvent = betaZodTool({
    name: "delete_event",
    description:
      "Remove an event from the user's calendar. First resolve the target with list_events and pass its eventId and occurrenceStart exactly. For repeating events, scope controls how much is removed; confirm with the user before deleting a whole series.",
    inputSchema: z.object({
      ...targetFields,
      scope: scopeSchema,
    }),
    run: async ({ eventId, occurrenceStart, scope }) => {
      await service.deleteEvent({ eventId, occurrenceStart }, scope);
      return JSON.stringify({ deleted: { eventId, occurrenceStart, scope } });
    },
  });

  return { listEvents, createEvent, updateEvent, deleteEvent };
}

export type EveTools = ReturnType<typeof createEveTools>;
