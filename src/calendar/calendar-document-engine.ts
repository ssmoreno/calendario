import {
  addDays,
  dateValueFromZoned,
  daysBetween,
  localDateTimeToZoned,
  timeValueFromZoned,
  timezoneFromZoned,
} from "./date-time";
import { messages } from "./messages";
import { expandEvent, truncateRuleBefore } from "./recurrence";
import { eventInputSchema } from "./schemas";
import type {
  CalendarDocument,
  CalendarRange,
  EventInput,
  EventPatch,
  EventRecord,
  EventTiming,
  MutationScope,
  Occurrence,
  OccurrenceTarget,
} from "./types";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `event-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mergeEventInput(event: EventRecord, patch: EventPatch): EventInput {
  const value = <Key extends keyof EventInput>(key: Key): EventInput[Key] =>
    Object.prototype.hasOwnProperty.call(patch, key)
      ? (patch[key] as EventInput[Key])
      : event[key];
  return eventInputSchema.parse({
    title: value("title"),
    timing: value("timing"),
    recurrence: value("recurrence"),
    location: value("location"),
    notes: value("notes"),
    color: value("color"),
    reminderMinutesBefore: value("reminderMinutesBefore"),
  });
}

function recordFromInput(
  input: EventInput,
  now: string,
  identity?: Pick<EventRecord, "id" | "createdAt">,
): EventRecord {
  const parsed = eventInputSchema.parse(input);
  return {
    ...parsed,
    id: identity?.id ?? newId(),
    createdAt: identity?.createdAt ?? now,
    updatedAt: now,
  };
}

function timingAtTarget(event: EventRecord, occurrenceStart: string): EventTiming {
  if (event.timing.kind === "timed") {
    return {
      ...event.timing,
      startsAt: occurrenceStart,
    };
  }
  const durationDays = Math.max(
    1,
    daysBetween(event.timing.startDate, event.timing.endDateExclusive),
  );
  return {
    kind: "all-day",
    startDate: occurrenceStart,
    endDateExclusive: addDays(occurrenceStart, durationDays),
  };
}

function rebaseSeriesTiming(
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

function normalizeSeriesPatch(
  base: EventRecord,
  source: EventRecord,
  target: OccurrenceTarget,
  patch: EventPatch,
): EventPatch {
  if (!Object.prototype.hasOwnProperty.call(patch, "timing") || !patch.timing) {
    return patch;
  }
  const selectedTiming = source.seriesId
    ? source.timing
    : timingAtTarget(base, target.occurrenceStart);
  return {
    ...patch,
    timing: rebaseSeriesTiming(base.timing, selectedTiming, patch.timing),
  };
}

export class CalendarDocumentEngine {
  constructor(
    private document: CalendarDocument,
    private readonly viewerTimeZone: string,
  ) {}

  getDocument(): CalendarDocument {
    return this.document;
  }

  adoptDocument(document: CalendarDocument): void {
    this.document = document;
  }

  listOccurrences(range: CalendarRange): Occurrence[] {
    const bases = this.document.events.filter((event) => !event.seriesId);
    const overrides = this.document.events.filter((event) => event.seriesId);
    return [...bases, ...overrides]
      .flatMap((event) => expandEvent(event, range, this.viewerTimeZone))
      .sort((a, b) => a.occurrenceStart.localeCompare(b.occurrenceStart));
  }

  listEventRecords(): EventRecord[] {
    return this.document.events.map((event) => ({
      ...event,
      timing: { ...event.timing },
      recurrence: event.recurrence
        ? {
            ...event.recurrence,
            excludedStarts: [...event.recurrence.excludedStarts],
          }
        : null,
    }));
  }

  setEventReminders(
    eventIds: string[],
    reminderMinutesBefore: number | undefined,
  ): void {
    if (eventIds.length === 0) return;
    const ids = new Set(eventIds);
    const found = this.document.events.filter((event) => ids.has(event.id));
    if (found.length !== ids.size) throw new Error(messages.domain.eventNotFound);
    const now = new Date().toISOString();
    this.commit(
      this.document.events.map((event) => {
        if (!ids.has(event.id)) return event;
        const updated = recordFromInput(
          mergeEventInput(event, { reminderMinutesBefore }),
          now,
          event,
        );
        return {
          ...updated,
          ...(event.seriesId ? { seriesId: event.seriesId } : {}),
          ...(event.originalStart ? { originalStart: event.originalStart } : {}),
        };
      }),
    );
  }

  createEvent(input: EventInput): EventRecord {
    const now = new Date().toISOString();
    const event = recordFromInput(input, now);
    this.commit([...this.document.events, event]);
    return event;
  }

  updateEvent(
    target: OccurrenceTarget,
    scope: MutationScope,
    patch: EventPatch,
  ): void {
    const source = this.document.events.find(
      (event) => event.id === target.eventId,
    );
    if (!source) throw new Error(messages.domain.eventNotFound);
    const base = source.seriesId
      ? this.document.events.find((event) => event.id === source.seriesId)
      : source;
    if (!base) throw new Error(messages.domain.seriesNotFound);
    const now = new Date().toISOString();

    if (!base.recurrence || scope === "series") {
      const normalizedPatch =
        scope === "series"
          ? normalizeSeriesPatch(base, source, target, patch)
          : patch;
      const recurrencePatched = Object.prototype.hasOwnProperty.call(
        normalizedPatch,
        "recurrence",
      );
      const patternChanged =
        recurrencePatched &&
        base.recurrence?.rrule !== normalizedPatch.recurrence?.rrule;
      const updated = recordFromInput(
        mergeEventInput(base, normalizedPatch),
        now,
        base,
      );
      const normalized =
        patternChanged && updated.recurrence
          ? {
              ...updated,
              recurrence: { ...updated.recurrence, excludedStarts: [] },
            }
          : updated;
      this.commit(
        this.document.events
          .filter((event) => !patternChanged || event.seriesId !== base.id)
          .map((event) => (event.id === base.id ? normalized : event)),
      );
      return;
    }

    if (scope === "occurrence") {
      if (source.seriesId) {
        const updated = recordFromInput(
          mergeEventInput(source, { ...patch, recurrence: null }),
          now,
          source,
        );
        this.commit(
          this.document.events.map((event) =>
            event.id === source.id
              ? {
                  ...updated,
                  seriesId: source.seriesId,
                  originalStart: source.originalStart,
                }
              : event,
          ),
        );
        return;
      }

      const baseInput = mergeEventInput(base, {
        timing: timingAtTarget(base, target.occurrenceStart),
        ...patch,
        recurrence: null,
      });
      const override: EventRecord = {
        ...recordFromInput(baseInput, now),
        seriesId: base.id,
        originalStart: target.occurrenceStart,
      };
      const excludedStarts = new Set(base.recurrence.excludedStarts);
      excludedStarts.add(target.occurrenceStart);
      const updatedBase: EventRecord = {
        ...base,
        recurrence: {
          ...base.recurrence,
          excludedStarts: [...excludedStarts],
        },
        updatedAt: now,
      };
      this.commit([
        ...this.document.events.map((event) =>
          event.id === base.id ? updatedBase : event,
        ),
        override,
      ]);
      return;
    }

    const split = truncateRuleBefore(
      base.recurrence.rrule,
      base,
      target.occurrenceStart,
    );
    const followingRecurrence = Object.prototype.hasOwnProperty.call(
      patch,
      "recurrence",
    )
      ? patch.recurrence
        ? {
            rrule:
              patch.recurrence.rrule === base.recurrence.rrule
                ? split.followingRule
                : patch.recurrence.rrule,
            excludedStarts: [],
          }
        : null
      : { rrule: split.followingRule, excludedStarts: [] };
    const followingInput = mergeEventInput(base, {
      timing: timingAtTarget(base, target.occurrenceStart),
      ...patch,
      recurrence: followingRecurrence,
    });
    const following = recordFromInput(followingInput, now);
    const retained = this.document.events.filter((event) => {
      if (event.id === base.id) return false;
      if (event.seriesId !== base.id || !event.originalStart) return true;
      return event.originalStart < target.occurrenceStart;
    });
    if (split.originalRule) {
      retained.push({
        ...base,
        recurrence: { ...base.recurrence, rrule: split.originalRule },
        updatedAt: now,
      });
    }
    retained.push(following);
    this.commit(retained);
  }

  deleteEvent(target: OccurrenceTarget, scope: MutationScope): void {
    const source = this.document.events.find(
      (event) => event.id === target.eventId,
    );
    if (!source) throw new Error(messages.domain.eventNotFound);
    const base = source.seriesId
      ? this.document.events.find((event) => event.id === source.seriesId)
      : source;
    if (!base) throw new Error(messages.domain.seriesNotFound);

    if (!base.recurrence || scope === "series") {
      this.commit(
        this.document.events.filter(
          (event) => event.id !== base.id && event.seriesId !== base.id,
        ),
      );
      return;
    }

    if (scope === "occurrence") {
      const now = new Date().toISOString();
      const recurrence = base.recurrence;
      const excludedStarts = new Set(recurrence.excludedStarts);
      excludedStarts.add(target.occurrenceStart);
      this.commit(
        this.document.events
          .filter((event) => event.id !== source.id || !source.seriesId)
          .map((event) =>
            event.id === base.id
              ? {
                  ...base,
                  recurrence: {
                    ...recurrence,
                    excludedStarts: [...excludedStarts],
                  },
                  updatedAt: now,
                }
              : event,
          ),
      );
      return;
    }

    const split = truncateRuleBefore(
      base.recurrence.rrule,
      base,
      target.occurrenceStart,
    );
    this.commit(
      this.document.events
        .filter((event) => {
          if (event.id === base.id) return false;
          if (event.seriesId !== base.id || !event.originalStart) return true;
          return event.originalStart < target.occurrenceStart;
        })
        .concat(
          split.originalRule
            ? [
                {
                  ...base,
                  recurrence: { ...base.recurrence, rrule: split.originalRule },
                  updatedAt: new Date().toISOString(),
                },
              ]
            : [],
        ),
    );
  }

  replaceEvents(events: EventRecord[]): void {
    this.commit(events);
  }

  private commit(events: EventRecord[]): void {
    this.document = {
      version: 1,
      revision: this.document.revision + 1,
      updatedAt: new Date().toISOString(),
      events,
    };
  }
}
