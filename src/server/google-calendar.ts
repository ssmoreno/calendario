import { fromDate } from "@internationalized/date";

import {
  addDays,
  localDateTimeToZoned,
  timingDateKeys,
  zonedTimestampToDate,
} from "@/calendar/date-time";
import { rebaseSeriesTiming, timingAtOccurrence } from "@/calendar/mutation-scope";
import { recurrenceDescription, truncateRuleBefore } from "@/calendar/recurrence";
import type {
  CalendarRange,
  CalendarService,
  EventColor,
  EventInput,
  EventPatch,
  EventRecord,
  EventTiming,
  MutationScope,
  Occurrence,
  OccurrenceTarget,
} from "@/calendar/types";
import {
  GOOGLE_CALENDAR_PROVIDER,
  GOOGLE_CALENDAR_SCOPE,
} from "@/lib/google-calendar";

import { auth } from "./auth";
import { prisma } from "./db";

const GOOGLE_CALENDAR_API =
  "https://www.googleapis.com/calendar/v3/calendars/primary";
const GOOGLE_PAGE_SIZE = 250;

const GOOGLE_COLOR_IDS: Record<EventColor, string> = {
  ultramarine: "9",
  coral: "11",
  mint: "10",
  gold: "5",
};

const EVENT_COLORS_BY_GOOGLE_ID = new Map(
  Object.entries(GOOGLE_COLOR_IDS).map(([color, id]) => [id, color as EventColor]),
);

interface GoogleEventDateTime {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}

interface GoogleEventReminder {
  method?: string;
  minutes?: number;
}

interface GoogleEvent {
  [key: string]: unknown;
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  colorId?: string;
  created?: string;
  updated?: string;
  start: GoogleEventDateTime;
  end: GoogleEventDateTime;
  originalStartTime?: GoogleEventDateTime;
  recurringEventId?: string;
  recurrence?: string[];
  reminders?: {
    useDefault?: boolean;
    overrides?: GoogleEventReminder[];
  };
}

const SPLIT_SERIES_FIELDS = [
  "anyoneCanAddSelf",
  "attachments",
  "attendees",
  "birthdayProperties",
  "colorId",
  "conferenceData",
  "description",
  "endTimeUnspecified",
  "eventType",
  "extendedProperties",
  "focusTimeProperties",
  "guestsCanInviteOthers",
  "guestsCanModify",
  "guestsCanSeeOtherGuests",
  "location",
  "outOfOfficeProperties",
  "reminders",
  "sequence",
  "source",
  "summary",
  "transparency",
  "visibility",
  "workingLocationProperties",
] as const;

interface GoogleEventsPage {
  items?: GoogleEvent[];
  nextPageToken?: string;
}

export type GoogleCalendarErrorKind =
  | "not_connected"
  | "authorization"
  | "unavailable";

export class GoogleCalendarError extends Error {
  constructor(
    readonly kind: GoogleCalendarErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GoogleCalendarError";
  }
}

export class GoogleCalendarBulkMutationError extends GoogleCalendarError {
  constructor(
    readonly succeededEventIds: string[],
    readonly failedEventIds: string[],
    kind: GoogleCalendarErrorKind,
  ) {
    super(
      kind,
      `Google Calendar updated ${succeededEventIds.length} of ${succeededEventIds.length + failedEventIds.length} events. ${failedEventIds.length} failed (${failedEventIds.join(", ")}). Check the calendar before retrying.`,
    );
    this.name = "GoogleCalendarBulkMutationError";
  }
}

export type UpcomingEvent =
  | {
      id: string;
      title: string;
      timing: {
        kind: "timed";
        startsAt: string;
        endsAt: string;
        timeZone: string;
      };
      location?: string;
      notes?: string;
      recurrence?: string;
      color: EventColor;
      reminderMinutes: number[];
      usesDefaultReminder: boolean;
    }
  | {
      id: string;
      title: string;
      timing: {
        kind: "all-day";
        startDate: string;
        endDateExclusive: string;
      };
      location?: string;
      notes?: string;
      recurrence?: string;
      color: EventColor;
      reminderMinutes: number[];
      usesDefaultReminder: boolean;
    };

type Fetch = typeof fetch;

function rruleFor(event: GoogleEvent): string | null {
  return event.recurrence?.find((line) => line.startsWith("RRULE:")) ?? null;
}

function reminderOverrides(event: GoogleEvent) {
  return (event.reminders?.overrides ?? [])
    .filter(
      (reminder): reminder is Required<GoogleEventReminder> =>
        typeof reminder.method === "string" && Number.isInteger(reminder.minutes),
    );
}

function reminderMinutes(event: GoogleEvent): number[] {
  return reminderOverrides(event)
    .filter((reminder) => reminder.method === "popup")
    .map((reminder) => reminder.minutes)
    .sort((a, b) => a - b);
}

function timeZoneFor(value: GoogleEventDateTime, fallback: string): string {
  return value.timeZone || fallback;
}

function toZonedTimestamp(
  value: GoogleEventDateTime,
  fallbackTimeZone: string,
): string {
  if (!value.dateTime) throw new Error("Google event is missing a date-time.");
  const timeZone = timeZoneFor(value, fallbackTimeZone);
  return fromDate(new Date(value.dateTime), timeZone).toString();
}

function timingFor(event: GoogleEvent, viewerTimeZone: string): EventTiming {
  if (event.start.date) {
    if (!event.end.date) throw new Error("Google all-day event is missing its end date.");
    return {
      kind: "all-day",
      startDate: event.start.date,
      endDateExclusive: event.end.date,
    };
  }
  const startsAt = toZonedTimestamp(event.start, viewerTimeZone);
  if (!event.end.dateTime) throw new Error("Google timed event is missing its end time.");
  const durationMinutes = Math.max(
    1,
    Math.round(
      (new Date(event.end.dateTime).getTime() -
        new Date(event.start.dateTime!).getTime()) /
        60_000,
    ),
  );
  return { kind: "timed", startsAt, durationMinutes };
}

function originalStartFor(
  event: GoogleEvent,
  timing: EventTiming,
  viewerTimeZone: string,
): string {
  if (event.originalStartTime?.date) return event.originalStartTime.date;
  if (event.originalStartTime?.dateTime) {
    return toZonedTimestamp(event.originalStartTime, viewerTimeZone);
  }
  return timing.kind === "timed" ? timing.startsAt : timing.startDate;
}

function recordFor(
  event: GoogleEvent,
  viewerTimeZone: string,
  parent?: GoogleEvent,
): EventRecord {
  const timing = timingFor(event, viewerTimeZone);
  const rule = rruleFor(parent ?? event);
  const reminders = reminderMinutes(event);
  return {
    id: event.id,
    title: event.summary?.trim() || "Untitled event",
    timing,
    recurrence: rule ? { rrule: rule.replace(/^RRULE:/, ""), excludedStarts: [] } : null,
    location: event.location || undefined,
    notes: event.description || undefined,
    color: EVENT_COLORS_BY_GOOGLE_ID.get(event.colorId ?? "") ?? "ultramarine",
    reminderMinutesBefore: reminders[0],
    reminderOverrides: reminderOverrides(event),
    usesDefaultReminder: event.reminders?.useDefault === true,
    seriesId: event.recurringEventId,
    originalStart: event.recurringEventId
      ? originalStartFor(event, timing, viewerTimeZone)
      : undefined,
    createdAt: event.created ?? new Date(0).toISOString(),
    updatedAt: event.updated ?? event.created ?? new Date(0).toISOString(),
  };
}

function googleTiming(timing: EventTiming) {
  if (timing.kind === "all-day") {
    return {
      start: { date: timing.startDate },
      end: { date: timing.endDateExclusive },
    };
  }
  const timeZone = timing.startsAt.match(/\[([^\]]+)\]$/)?.[1] ?? "UTC";
  const startsAt = zonedTimestampToDate(timing.startsAt);
  const endsAt = new Date(startsAt.getTime() + timing.durationMinutes * 60_000);
  return {
    start: { dateTime: startsAt.toISOString(), timeZone },
    end: { dateTime: endsAt.toISOString(), timeZone },
  };
}

function googleReminder(minutesBefore: number | undefined) {
  return {
    useDefault: false,
    overrides:
      minutesBefore === undefined
        ? []
        : [{ method: "popup", minutes: minutesBefore }],
  };
}

function createPayload(input: EventInput): Record<string, unknown> {
  return {
    summary: input.title,
    ...googleTiming(input.timing),
    ...(input.recurrence
      ? { recurrence: [`RRULE:${input.recurrence.rrule.replace(/^RRULE:/, "")}`] }
      : {}),
    ...(input.location ? { location: input.location } : {}),
    ...(input.notes ? { description: input.notes } : {}),
    colorId: GOOGLE_COLOR_IDS[input.color],
    reminders: input.usesDefaultReminder
      ? { useDefault: true }
      : googleReminder(input.reminderMinutesBefore),
  };
}

function patchPayload(patch: EventPatch): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (patch.title !== undefined) payload.summary = patch.title;
  if (patch.timing !== undefined) Object.assign(payload, googleTiming(patch.timing));
  if (Object.hasOwn(patch, "recurrence")) {
    payload.recurrence = patch.recurrence
      ? [`RRULE:${patch.recurrence.rrule.replace(/^RRULE:/, "")}`]
      : [];
  }
  if (Object.hasOwn(patch, "location")) payload.location = patch.location ?? null;
  if (Object.hasOwn(patch, "notes")) payload.description = patch.notes ?? null;
  if (patch.color !== undefined) payload.colorId = GOOGLE_COLOR_IDS[patch.color];
  if (Object.hasOwn(patch, "reminderMinutesBefore")) {
    payload.reminders = googleReminder(patch.reminderMinutesBefore);
  }
  return payload;
}

function followingSeriesPayload(
  parent: GoogleEvent,
  timing: EventTiming,
  followingRecurrence: string[],
  patch: EventPatch,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of SPLIT_SERIES_FIELDS) {
    if (parent[field] !== undefined) payload[field] = parent[field];
  }
  return {
    ...payload,
    ...googleTiming(timing),
    recurrence: followingRecurrence,
    ...patchPayload(patch),
  };
}

function recurrenceWithRule(
  event: GoogleEvent,
  rule: string,
  includeExDates: boolean,
): string[] {
  const lines = event.recurrence ?? [];
  const rrules = lines.filter((line) => line.startsWith("RRULE:"));
  const unsupported = lines.find(
    (line) => !line.startsWith("RRULE:") && !line.startsWith("EXDATE"),
  );
  if (rrules.length !== 1 || unsupported) {
    throw new Error(
      "This Google recurring event uses a recurrence pattern that cannot be split safely.",
    );
  }
  return [
    `RRULE:${rule}`,
    ...(includeExDates
      ? lines.filter((line) => line.startsWith("EXDATE"))
      : []),
  ];
}

function googleUntilBefore(
  timing: EventTiming,
  occurrenceStart: string,
): string {
  if (timing.kind === "all-day") {
    return addDays(occurrenceStart, -1).replaceAll("-", "");
  }
  return new Date(zonedTimestampToDate(occurrenceStart).getTime() - 1_000)
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z");
}

function googleSplitRuleBefore(
  rule: string,
  record: EventRecord,
  occurrenceStart: string,
) {
  const split = truncateRuleBefore(rule, record, occurrenceStart);
  if (!split.originalRule?.includes("UNTIL=")) return split;
  return {
    ...split,
    originalRule: split.originalRule.replace(
      /UNTIL=[^;]+/,
      `UNTIL=${googleUntilBefore(record.timing, occurrenceStart)}`,
    ),
  };
}

function upcomingEventFor(
  event: GoogleEvent,
  viewerTimeZone: string,
  parent?: GoogleEvent,
): UpcomingEvent {
  const common = {
    id: event.id,
    title: event.summary?.trim() || "Untitled event",
    location: event.location || undefined,
    notes: event.description || undefined,
    recurrence: rruleFor(parent ?? event)
      ? recurrenceDescription(rruleFor(parent ?? event)!)
      : undefined,
    color: EVENT_COLORS_BY_GOOGLE_ID.get(event.colorId ?? "") ?? "ultramarine",
    reminderMinutes: reminderMinutes(event),
    usesDefaultReminder: event.reminders?.useDefault === true,
  };
  if (event.start.date) {
    return {
      ...common,
      timing: {
        kind: "all-day",
        startDate: event.start.date,
        endDateExclusive: event.end.date ?? addDays(event.start.date, 1),
      },
    };
  }
  const timeZone = timeZoneFor(event.start, viewerTimeZone);
  return {
    ...common,
    timing: {
      kind: "timed",
      startsAt: new Date(event.start.dateTime!).toISOString(),
      endsAt: new Date(event.end.dateTime!).toISOString(),
      timeZone,
    },
  };
}

export async function hasGoogleCalendarConnection(userId: string) {
  return (
    (await prisma.account.count({
      where: {
        userId,
        providerId: GOOGLE_CALENDAR_PROVIDER,
        scope: { contains: GOOGLE_CALENDAR_SCOPE },
      },
    })) > 0
  );
}

async function accessTokenFor(userId: string): Promise<string> {
  if (!(await hasGoogleCalendarConnection(userId))) {
    throw new GoogleCalendarError(
      "not_connected",
      "Connect Google Calendar to continue.",
    );
  }
  try {
    const tokens = await auth.api.getAccessToken({
      body: { providerId: GOOGLE_CALENDAR_PROVIDER, userId },
    });
    if (!tokens.accessToken) throw new Error("Google returned no access token.");
    return tokens.accessToken;
  } catch {
    throw new GoogleCalendarError(
      "authorization",
      "Google Calendar access needs to be renewed.",
    );
  }
}

export async function googleCalendarForUser(
  userId: string,
  timeZone: string,
  fetcher: Fetch = fetch,
): Promise<GoogleCalendarService> {
  return new GoogleCalendarService(await accessTokenFor(userId), timeZone, fetcher);
}

export class GoogleCalendarService implements CalendarService {
  private readonly eventCache = new Map<string, GoogleEvent>();

  constructor(
    private readonly accessToken: string,
    private readonly viewerTimeZone: string,
    private readonly fetcher: Fetch = fetch,
  ) {}

  private async request<Result>(
    path: string,
    init?: RequestInit,
  ): Promise<Result> {
    let response: Response;
    try {
      response = await this.fetcher(`${GOOGLE_CALENDAR_API}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${this.accessToken}`,
          ...(init?.body ? { "content-type": "application/json" } : {}),
          ...init?.headers,
        },
      });
    } catch {
      throw new GoogleCalendarError(
        "unavailable",
        "Google Calendar is temporarily unavailable.",
      );
    }
    if (!response.ok) {
      const kind = response.status === 401 || response.status === 403
        ? "authorization"
        : "unavailable";
      throw new GoogleCalendarError(
        kind,
        kind === "authorization"
          ? "Google Calendar access needs to be renewed."
          : "Google Calendar could not complete that request.",
        response.status,
      );
    }
    if (response.status === 204) return undefined as Result;
    return (await response.json()) as Result;
  }

  private async listGoogleEvents(
    query: URLSearchParams,
  ): Promise<GoogleEvent[]> {
    const events: GoogleEvent[] = [];
    let pageToken: string | undefined;
    do {
      const pageQuery = new URLSearchParams(query);
      pageQuery.set("maxResults", String(GOOGLE_PAGE_SIZE));
      if (pageToken) pageQuery.set("pageToken", pageToken);
      const page = await this.request<GoogleEventsPage>(
        `/events?${pageQuery.toString()}`,
      );
      for (const event of page.items ?? []) {
        if (event.status !== "cancelled") {
          events.push(event);
          this.eventCache.set(event.id, event);
        }
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
    return events;
  }

  private async getGoogleEvent(id: string): Promise<GoogleEvent> {
    const cached = this.eventCache.get(id);
    if (cached) return cached;
    const event = await this.request<GoogleEvent>(
      `/events/${encodeURIComponent(id)}`,
    );
    this.eventCache.set(id, event);
    return event;
  }

  private async refreshGoogleEvent(id: string): Promise<GoogleEvent> {
    const event = await this.request<GoogleEvent>(
      `/events/${encodeURIComponent(id)}`,
    );
    this.eventCache.set(id, event);
    return event;
  }

  private async parentsFor(events: GoogleEvent[]) {
    const ids = [...new Set(events.flatMap((event) => event.recurringEventId ?? []))];
    await Promise.all(ids.map((id) => this.getGoogleEvent(id)));
  }

  async listUpcoming(limit = 4): Promise<UpcomingEvent[]> {
    const query = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: new Date().toISOString(),
      maxResults: String(limit),
    });
    const page = await this.request<GoogleEventsPage>(`/events?${query}`);
    const events = (page.items ?? []).filter((event) => event.status !== "cancelled");
    await this.parentsFor(events);
    return events.slice(0, limit).map((event) =>
      upcomingEventFor(
        event,
        this.viewerTimeZone,
        event.recurringEventId
          ? this.eventCache.get(event.recurringEventId)
          : undefined,
      ),
    );
  }

  async listEventRecords(): Promise<EventRecord[]> {
    const events = await this.listGoogleEvents(
      new URLSearchParams({ singleEvents: "false", showDeleted: "false" }),
    );
    return events.map((event) => recordFor(event, this.viewerTimeZone));
  }

  async listOccurrences(range: CalendarRange): Promise<Occurrence[]> {
    const timeMin = localDateTimeToZoned(range.from, "00:00", this.viewerTimeZone);
    const timeMax = localDateTimeToZoned(
      addDays(range.to, 1),
      "00:00",
      this.viewerTimeZone,
    );
    const events = await this.listGoogleEvents(
      new URLSearchParams({
        singleEvents: "true",
        orderBy: "startTime",
        timeMin: zonedTimestampToDate(timeMin).toISOString(),
        timeMax: zonedTimestampToDate(timeMax).toISOString(),
        showDeleted: "false",
      }),
    );
    await this.parentsFor(events);
    return events.map((event) => {
      const parent = event.recurringEventId
        ? this.eventCache.get(event.recurringEventId)
        : undefined;
      const record = recordFor(event, this.viewerTimeZone, parent);
      const occurrenceStart = originalStartFor(
        event,
        record.timing,
        this.viewerTimeZone,
      );
      return {
        key: `${event.id}:${occurrenceStart}`,
        eventId: event.id,
        rootEventId: event.recurringEventId ?? event.id,
        occurrenceStart,
        record,
        timing: record.timing,
        dateKeys: timingDateKeys(record.timing, this.viewerTimeZone),
        isOverride: Boolean(event.recurringEventId),
      };
    });
  }

  async createEvent(input: EventInput): Promise<EventRecord> {
    const event = await this.request<GoogleEvent>("/events", {
      method: "POST",
      body: JSON.stringify(createPayload(input)),
    });
    this.eventCache.set(event.id, event);
    return recordFor(event, this.viewerTimeZone);
  }

  private targetId(event: GoogleEvent, scope: MutationScope) {
    return scope === "series" ? event.recurringEventId ?? event.id : event.id;
  }

  private async patchEvent(id: string, patch: Record<string, unknown>) {
    const event = await this.request<GoogleEvent>(
      `/events/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    );
    this.eventCache.set(id, event);
    return event;
  }

  private async updateFollowing(event: GoogleEvent, patch: EventPatch) {
    const parentId = event.recurringEventId ?? event.id;
    const parent = await this.getGoogleEvent(parentId);
    const parentRecord = recordFor(parent, this.viewerTimeZone);
    const occurrenceTiming = timingFor(event, this.viewerTimeZone);
    const occurrenceStart = originalStartFor(event, occurrenceTiming, this.viewerTimeZone);
    const rule = parentRecord.recurrence?.rrule;
    if (!rule) {
      throw new Error(
        "This Google recurring event uses a recurrence pattern that cannot be split safely.",
      );
    }
    const split = googleSplitRuleBefore(rule, parentRecord, occurrenceStart);
    if (!split.originalRule) return await this.patchEvent(parentId, patchPayload(patch));
    const trimmedRecurrence = recurrenceWithRule(
      parent,
      split.originalRule,
      true,
    );
    const followingRecurrence = recurrenceWithRule(
      parent,
      split.followingRule,
      false,
    );

    const created = await this.request<GoogleEvent>(
      "/events?supportsAttachments=true&conferenceDataVersion=1",
      {
        method: "POST",
        body: JSON.stringify(
          followingSeriesPayload(
            parent,
            occurrenceTiming,
            followingRecurrence,
            patch,
          ),
        ),
      },
    );
    try {
      await this.patchEvent(parentId, {
        recurrence: trimmedRecurrence,
      });
    } catch (error) {
      let refreshed: GoogleEvent;
      try {
        refreshed = await this.refreshGoogleEvent(parentId);
      } catch {
        throw new GoogleCalendarError(
          "unavailable",
          "Google Calendar could not confirm whether the split completed. Check the calendar before retrying.",
        );
      }
      const refreshedRule = rruleFor(refreshed)?.replace(/^RRULE:/, "");
      if (refreshedRule === split.originalRule) return;
      if (refreshedRule !== rule) {
        throw new GoogleCalendarError(
          "unavailable",
          "Google Calendar returned an unexpected series state after the split. Check the calendar before retrying.",
        );
      }
      try {
        await this.request<void>(`/events/${encodeURIComponent(created.id)}`, {
          method: "DELETE",
        });
      } catch {
        throw new GoogleCalendarError(
          "unavailable",
          "Google Calendar could not finish the split or remove the replacement series. Check the calendar before retrying.",
        );
      }
      throw error;
    }
  }

  async updateEvent(
    target: OccurrenceTarget,
    scope: MutationScope,
    patch: EventPatch,
  ): Promise<void> {
    const event = await this.getGoogleEvent(target.eventId);
    if (scope === "following" && (event.recurringEventId || event.recurrence)) {
      await this.updateFollowing(event, patch);
      return;
    }
    if (scope === "series" && event.recurringEventId && patch.timing) {
      const parent = await this.getGoogleEvent(event.recurringEventId);
      const parentTiming = timingFor(parent, this.viewerTimeZone);
      patch = {
        ...patch,
        timing: rebaseSeriesTiming(
          parentTiming,
          timingFor(event, this.viewerTimeZone),
          patch.timing,
        ),
      };
    } else if (scope === "series" && event.recurrence && patch.timing) {
      const parentTiming = timingFor(event, this.viewerTimeZone);
      patch = {
        ...patch,
        timing: rebaseSeriesTiming(
          parentTiming,
          timingAtOccurrence(parentTiming, target.occurrenceStart),
          patch.timing,
        ),
      };
    }
    await this.patchEvent(this.targetId(event, scope), patchPayload(patch));
  }

  async deleteEvent(
    target: OccurrenceTarget,
    scope: MutationScope,
  ): Promise<void> {
    const event = await this.getGoogleEvent(target.eventId);
    if (scope === "following" && (event.recurringEventId || event.recurrence)) {
      const parentId = event.recurringEventId ?? event.id;
      const parent = await this.getGoogleEvent(parentId);
      const parentRecord = recordFor(parent, this.viewerTimeZone);
      const occurrenceTiming = timingFor(event, this.viewerTimeZone);
      const occurrenceStart = originalStartFor(event, occurrenceTiming, this.viewerTimeZone);
      const rule = parentRecord.recurrence?.rrule;
      if (!rule) {
        throw new Error(
          "This Google recurring event uses a recurrence pattern that cannot be split safely.",
        );
      }
      const split = googleSplitRuleBefore(rule, parentRecord, occurrenceStart);
      if (split.originalRule) {
          const trimmedRecurrence = recurrenceWithRule(
            parent,
            split.originalRule,
            true,
          );
        await this.patchEvent(parentId, {
          recurrence: trimmedRecurrence,
        });
        return;
      }
      await this.request<void>(`/events/${encodeURIComponent(parentId)}`, {
        method: "DELETE",
      });
      return;
    }
    await this.request<void>(
      `/events/${encodeURIComponent(this.targetId(event, scope))}`,
      { method: "DELETE" },
    );
  }

  async setEventReminders(
    eventIds: string[],
    reminderMinutesBefore: number | undefined,
  ): Promise<void> {
    const queue = [...eventIds];
    const succeededEventIds: string[] = [];
    const failures: { id: string; error: unknown }[] = [];
    const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
      for (;;) {
        const id = queue.shift();
        if (!id) return;
        try {
          await this.patchEvent(id, {
            reminders: googleReminder(reminderMinutesBefore),
          });
          succeededEventIds.push(id);
        } catch (error) {
          failures.push({ id, error });
        }
      }
    });
    await Promise.all(workers);
    if (failures.length) {
      const kind = failures.some(
        ({ error }) =>
          error instanceof GoogleCalendarError && error.kind === "authorization",
      )
        ? "authorization"
        : "unavailable";
      throw new GoogleCalendarBulkMutationError(
        succeededEventIds,
        failures.map(({ id }) => id),
        kind,
      );
    }
  }
}
