import { z } from "zod";

import {
  addDays,
  dateKeyInTimeZone,
  daysBetween,
  isDateKey,
  isTimeZone,
  localDateTimeToZoned,
  zonedTimestampToDate,
} from "@/calendar/date-time";
import {
  MAX_REMINDER_MINUTES,
  REMINDER_UNITS,
  reminderMinutes,
} from "@/calendar/reminders";
import {
  DEFAULT_USER_SETTINGS,
  type UserSettings,
} from "@/calendar/settings";
import { EVENT_COLORS } from "@/calendar/types";
import type {
  EventColor,
  EventInput,
  EventPatch,
  EventRecord,
  EventTiming,
  Occurrence,
  CalendarService,
} from "@/calendar/types";

const MAX_RANGE_DAYS = 366;
const MAX_LISTED_OCCURRENCES = 200;
const NOTES_PREVIEW_LENGTH = 280;
const FRIENDLY_EVENT_COLORS = ["blue", "red", "green", "yellow"] as const;

type FriendlyEventColor = (typeof FRIENDLY_EVENT_COLORS)[number];

const COLOR_ALIASES: Record<FriendlyEventColor, EventColor> = {
  blue: "ultramarine",
  red: "coral",
  green: "mint",
  yellow: "gold",
} as const;

export const selectableColorSchema = z.enum([
  ...EVENT_COLORS,
  ...FRIENDLY_EVENT_COLORS,
]);

export const reminderOffsetSchema = z
  .object({
    amount: z
      .number()
      .nonnegative()
      .describe("How many of the selected units before the event starts."),
    unit: z.enum(REMINDER_UNITS).describe("Unit for amount."),
  })
  .refine(
    (offset) => {
      const minutes = reminderMinutes(offset);
      return Number.isSafeInteger(minutes) && minutes <= MAX_REMINDER_MINUTES;
    },
    `The reminder must resolve to a whole number of minutes no more than ${MAX_REMINDER_MINUTES}.`,
  )
  .describe(
    "A precise lead time before the event. Preserve the user's unit: 5 days is { amount: 5, unit: 'days' }; 22 minutes is { amount: 22, unit: 'minutes' }.",
  );

const eventSelectorSchema = z
  .object({
    all: z
      .boolean()
      .optional()
      .describe("Set true only when the user explicitly says every event."),
    eventIds: z
      .array(z.string().min(1))
      .min(1)
      .optional()
      .describe("Exact event IDs. A record must match one of them."),
    query: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        "Case-insensitive text matched against title, location, and notes.",
      ),
    colors: z
      .array(selectableColorSchema)
      .min(1)
      .optional()
      .describe(
        "Event colors. Friendly names map to saved colors: blue=ultramarine, red=coral, green=mint, yellow=gold.",
      ),
    timing: z
      .enum(["timed", "all-day"])
      .optional()
      .describe("Match only timed or all-day events."),
    repeating: z
      .boolean()
      .optional()
      .describe("True for repeating events; false for one-off events."),
    hasReminder: z
      .boolean()
      .optional()
      .describe("Match events based on whether they currently have a reminder."),
  })
  .refine(
    (selector) =>
      selector.all === true ||
      selector.eventIds !== undefined ||
      selector.query !== undefined ||
      selector.colors !== undefined ||
      selector.timing !== undefined ||
      selector.repeating !== undefined ||
      selector.hasReminder !== undefined,
    "Choose at least one event property, or set all to true.",
  )
  .describe(
    "Select saved events. Different fields combine with AND; values within eventIds or colors combine with OR.",
  );

const dateKeySchema = z
  .string()
  .refine(isDateKey, "Use a real calendar date in YYYY-MM-DD format.");

const timedTimingFields = {
  kind: z.literal("timed"),
  date: dateKeySchema.describe("Start date, YYYY-MM-DD."),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM.")
    .describe("Start time in 24-hour HH:MM, e.g. 09:30 or 17:00."),
  timeZone: z
    .string()
    .refine(isTimeZone, "Use an IANA timezone like Europe/Madrid.")
    .optional()
    .describe("IANA timezone of the start time. Omit to use the user's timezone."),
};

const durationMinutesSchema = z.number().int().positive().max(525_600);

const timedTimingSchema = z.object({
  ...timedTimingFields,
  durationMinutes: durationMinutesSchema.describe(
    "Event length in minutes. If the user gave an end time, convert it to minutes.",
  ),
});

const newTimedTimingSchema = z.object({
  ...timedTimingFields,
  durationMinutes: durationMinutesSchema
    .optional()
    .describe(
      "Event length in minutes. If the user gave an end time, convert it to minutes. Omit to use the length the user saved as their default.",
    ),
});

const allDayTimingSchema = z.object({
  kind: z.literal("all-day"),
  startDate: dateKeySchema.describe("First day of the event, YYYY-MM-DD."),
  endDate: dateKeySchema
    .optional()
    .describe("Last day of the event, inclusive. Omit for a single-day event."),
});

const timingDescription =
  'Use kind "timed" for events at a clock time and "all-day" for date-only events.';

const timingSchema = z
  .discriminatedUnion("kind", [timedTimingSchema, allDayTimingSchema])
  .describe(timingDescription);

const newTimingSchema = z
  .discriminatedUnion("kind", [newTimedTimingSchema, allDayTimingSchema])
  .describe(timingDescription);

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

export function savedColor(
  color: z.infer<typeof selectableColorSchema>,
): EventRecord["color"] {
  if ((FRIENDLY_EVENT_COLORS as readonly string[]).includes(color)) {
    return COLOR_ALIASES[color as FriendlyEventColor];
  }
  return color as EventColor;
}

function recordMatchesSelector(
  record: EventRecord,
  selector: z.infer<typeof eventSelectorSchema>,
): boolean {
  if (selector.eventIds && !selector.eventIds.includes(record.id)) return false;
  if (selector.query) {
    const needle = selector.query.toLowerCase();
    const textMatches = [record.title, record.location, record.notes].some(
      (field) => field?.toLowerCase().includes(needle),
    );
    if (!textMatches) return false;
  }
  if (selector.colors) {
    const colors = selector.colors.map(savedColor);
    if (!colors.includes(record.color)) return false;
  }
  if (selector.timing && record.timing.kind !== selector.timing) return false;
  if (
    selector.repeating !== undefined &&
    Boolean(record.recurrence || record.seriesId) !== selector.repeating
  ) {
    return false;
  }
  if (
    selector.hasReminder !== undefined &&
    (record.reminderOverrides
      ? record.reminderOverrides.length > 0 || record.usesDefaultReminder === true
      : record.reminderMinutesBefore !== undefined ||
        record.usesDefaultReminder === true) !== selector.hasReminder
  ) {
    return false;
  }
  return true;
}

function hasExactReminder(
  record: EventRecord,
  reminderMinutesBefore: number | undefined,
): boolean {
  if (!record.reminderOverrides) {
    return (
      !record.usesDefaultReminder &&
      record.reminderMinutesBefore === reminderMinutesBefore
    );
  }
  if (record.usesDefaultReminder) return false;
  if (reminderMinutesBefore === undefined) {
    return record.reminderOverrides.length === 0;
  }
  return (
    record.reminderOverrides.length === 1 &&
    record.reminderOverrides[0].method === "popup" &&
    record.reminderOverrides[0].minutes === reminderMinutesBefore
  );
}

function toEventTiming(
  input: z.infer<typeof newTimingSchema>,
  defaultTimeZone: string,
  defaultDurationMinutes: number,
): EventTiming {
  if (input.kind === "timed") {
    return {
      kind: "timed",
      startsAt: localDateTimeToZoned(
        input.date,
        input.time,
        input.timeZone ?? defaultTimeZone,
      ),
      durationMinutes: input.durationMinutes ?? defaultDurationMinutes,
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

function hasSameTiming(a: EventTiming, b: EventTiming): boolean {
  if (a.kind === "timed") {
    return (
      b.kind === "timed" &&
      zonedTimestampToDate(a.startsAt).getTime() ===
        zonedTimestampToDate(b.startsAt).getTime() &&
      a.durationMinutes === b.durationMinutes
    );
  }
  return (
    b.kind === "all-day" &&
    a.startDate === b.startDate &&
    a.endDateExclusive === b.endDateExclusive
  );
}

function normalizeRRule(rrule: string | undefined): string | undefined {
  const source = rrule?.replace(/^RRULE:/, "");
  if (!source) return undefined;
  return source
    .split(";")
    .map((part) => {
      const [name, ...rawValue] = part.split("=");
      const value = rawValue.join("=").split(",").sort().join(",");
      return `${name}=${value}`;
    })
    .sort((a, b) => {
      if (a.startsWith("FREQ=")) return -1;
      if (b.startsWith("FREQ=")) return 1;
      return a.localeCompare(b);
    })
    .join(";");
}

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function isSameEvent(record: EventRecord, input: EventInput): boolean {
  return (
    record.title.trim().toLowerCase() === input.title.trim().toLowerCase() &&
    normalizeRRule(record.recurrence?.rrule ?? undefined) ===
      normalizeRRule(input.recurrence?.rrule ?? undefined) &&
    optionalText(record.location) === input.location &&
    optionalText(record.notes) === input.notes &&
    record.color === input.color &&
    hasExactReminder(record, input.reminderMinutesBefore)
  );
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
    usesCalendarDefaultReminder: record.usesDefaultReminder || undefined,
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
  timeZone: string;
  /** Fills in whatever the user did not spell out when creating an event. */
  defaults?: UserSettings;
}

function calendarTool<Schema extends z.ZodType, Output>(definition: {
  description: string;
  inputSchema: Schema;
  run: (input: z.infer<Schema>) => Output | Promise<Output>;
}) {
  return {
    ...definition,
    parse: (input: unknown) => definition.inputSchema.parse(input),
  };
}

export function createEveTools(
  service: CalendarService,
  { timeZone, defaults = DEFAULT_USER_SETTINGS }: EveToolsOptions,
) {
  const listEvents = calendarTool({
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
      colors: z
        .array(selectableColorSchema)
        .min(1)
        .optional()
        .describe(
          "Optional color filter. Friendly names map as blue=ultramarine, red=coral, green=mint, yellow=gold.",
        ),
    }),
    run: async ({ from, to, query, colors }) => {
      const span = daysBetween(from, to);
      if (span < 0) throw new Error("`to` must be on or after `from`.");
      if (span > MAX_RANGE_DAYS) {
        throw new Error(
          `That range is too wide — request ${MAX_RANGE_DAYS} days or fewer.`,
        );
      }
      const occurrences = await service.listOccurrences({ from, to });
      const needle = query?.toLowerCase();
      const savedColors = colors?.map(savedColor);
      const matches = occurrences.filter(({ record }) => {
        const matchesText =
          !needle ||
          [record.title, record.location, record.notes].some((field) =>
            field?.toLowerCase().includes(needle),
          );
        return (
          matchesText && (!savedColors || savedColors.includes(record.color))
        );
      });
      return {
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
      };
    },
  });

  /**
   * A subagent starts a fresh session for every task, so a task it has already
   * carried out looks new to it. Reading the target day before writing turns a
   * repeated create into a report that the event is already there. All resolved
   * details count, so a different span, repetition, or other field still goes
   * through. A failed read just means no answer here: the guard is a backstop,
   * and losing it must not lose the event.
   */
  async function occurrenceAlreadySaved(input: EventInput) {
    const dateKey =
      input.timing.kind === "timed"
        ? dateKeyInTimeZone(
            zonedTimestampToDate(input.timing.startsAt),
            timeZone,
          )
        : input.timing.startDate;
    const occurrences = await service
      .listOccurrences({ from: dateKey, to: dateKey })
      .catch(() => []);
    return occurrences.find(
      (occurrence) =>
        isSameEvent(occurrence.record, input) &&
        hasSameTiming(occurrence.rootTiming, input.timing),
    );
  }

  const createEvent = calendarTool({
    description:
      "Add a new event to the user's calendar, with a reminder when the user wants one. Call when the user wants to schedule, add, book, or block time. Do not use this to change an existing event — use update_event for that. When the same event with the same resolved details is already saved nothing is added, and the saved one comes back as alreadyExists, unless the user explicitly asks for another identical event.",
    inputSchema: z.object({
      title: z.string().trim().min(1).max(160).describe("Event title."),
      timing: newTimingSchema,
      rrule: rruleSchema.optional().describe(
        "Include only when the event repeats.",
      ),
      location: z.string().trim().max(240).optional(),
      notes: z.string().trim().max(10_000).optional(),
      color: selectableColorSchema.optional().describe(
        "Calendar color. Friendly names map as blue=ultramarine, red=coral, green=mint, yellow=gold. Omit unless the user asks for one, and the user's default color is used.",
      ),
      reminder: reminderOffsetSchema
        .nullish()
        .describe(
          "When to remind before the event starts. Omit to use the user's default reminder, or pass null when they ask for no reminder at all.",
        ),
      allowDuplicate: z
        .boolean()
        .optional()
        .describe(
          "Set true only when the user explicitly asks to create another identical event even though one already exists.",
        ),
    }),
    run: async (input) => {
      try {
        const timing = toEventTiming(
          input.timing,
          timeZone,
          defaults.defaultDurationMinutes,
        );
        const event: EventInput = {
          title: input.title,
          timing,
          recurrence: input.rrule
            ? { rrule: normalizeRRule(input.rrule)!, excludedStarts: [] }
            : null,
          location: optionalText(input.location),
          notes: optionalText(input.notes),
          color: input.color ? savedColor(input.color) : defaults.defaultColor,
          reminderMinutesBefore:
            input.reminder === undefined
              ? (defaults.defaultReminderMinutes ?? undefined)
              : input.reminder === null
                ? undefined
                : reminderMinutes(input.reminder),
        };
        const saved = input.allowDuplicate
          ? undefined
          : await occurrenceAlreadySaved(event);
        if (saved) return { alreadyExists: describeOccurrence(saved) };
        const record = await service.createEvent(event);
        return { created: describeRecord(record) };
      } catch (error) {
        toReadableError(error);
      }
    },
  });

  const updateEvent = calendarTool({
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
          color: selectableColorSchema.optional().describe(
            "New color. Friendly names map as blue=ultramarine, red=coral, green=mint, yellow=gold.",
          ),
          reminder: reminderOffsetSchema
            .nullable()
            .optional()
            .describe("New lead time, or null to remove the reminder."),
        })
        .describe("Only the fields to change."),
    }),
    run: async ({ eventId, occurrenceStart, scope, changes }) => {
      const patch: EventPatch = {};
      if (changes.title !== undefined) patch.title = changes.title;
      if (changes.timing !== undefined) {
        patch.timing = toEventTiming(
          changes.timing,
          timeZone,
          defaults.defaultDurationMinutes,
        );
      }
      if (hasKey(changes, "rrule")) {
        patch.recurrence =
          changes.rrule == null
            ? null
            : { rrule: changes.rrule, excludedStarts: [] };
      }
      if (hasKey(changes, "location")) patch.location = changes.location ?? undefined;
      if (hasKey(changes, "notes")) patch.notes = changes.notes ?? undefined;
      if (changes.color !== undefined) patch.color = savedColor(changes.color);
      if (hasKey(changes, "reminder")) {
        patch.reminderMinutesBefore = changes.reminder
          ? reminderMinutes(changes.reminder)
          : undefined;
      }
      if (Object.keys(patch).length === 0) {
        throw new Error("No changes provided — include at least one field in `changes`.");
      }
      try {
        await service.updateEvent({ eventId, occurrenceStart }, scope, patch);
      } catch (error) {
        toReadableError(error);
      }
      return {
        updated: { eventId, occurrenceStart, scope, fields: Object.keys(patch) },
      };
    },
  });

  const deleteEvent = calendarTool({
    description:
      "Remove an event from the user's calendar. First resolve the target with list_events and pass its eventId and occurrenceStart exactly. For repeating events, scope controls how much is removed; confirm with the user before deleting a whole series.",
    inputSchema: z.object({
      ...targetFields,
      scope: scopeSchema,
    }),
    run: async ({ eventId, occurrenceStart, scope }) => {
      await service.deleteEvent({ eventId, occurrenceStart }, scope);
      return { deleted: { eventId, occurrenceStart, scope } };
    },
  });

  const setEventReminders = calendarTool({
    description:
      "Set or remove a reminder across a user-described group of saved events in one operation, including whole repeating series and matching series exceptions. Use for words such as each, every, all, any, or events matching a property (for example every red event). This changes the saved events themselves, so matching future occurrences of a repeating series inherit the reminder. Use list_events plus update_event for one specific event.",
    inputSchema: z.object({
      selector: eventSelectorSchema,
      reminder: reminderOffsetSchema
        .nullable()
        .describe("Lead time to set, or null to remove matching reminders."),
    }),
    run: async ({ selector, reminder }) => {
      const records = await service.listEventRecords();
      const matches = records.filter((record) =>
        recordMatchesSelector(record, selector),
      );
      const minutesBefore = reminder ? reminderMinutes(reminder) : undefined;
      const changed = matches.filter(
        (record) => !hasExactReminder(record, minutesBefore),
      );

      await service.setEventReminders(
        changed.map((record) => record.id),
        minutesBefore,
      );

      return {
        matchedCount: matches.length,
        changedCount: changed.length,
        reminderMinutesBefore: minutesBefore ?? null,
        events: matches.map(({ id, title, color, seriesId, originalStart }) => ({
          eventId: id,
          title,
          color,
          isSeriesException: Boolean(seriesId) || undefined,
          occurrenceStart: originalStart,
        })),
      };
    },
  });

  return {
    listEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    setEventReminders,
  };
}

export type EveTools = ReturnType<typeof createEveTools>;
