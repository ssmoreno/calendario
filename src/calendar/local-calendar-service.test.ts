import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  dateValueFromZoned,
  localDateTimeToZoned,
  timeValueFromZoned,
} from "./date-time";
import { LocalCalendarService } from "./local-calendar-service";
import { EVENTS_STORAGE_KEY } from "./storage";
import type { EventInput } from "./types";

const input: EventInput = {
  title: "Swim",
  timing: {
    kind: "timed",
    startsAt: localDateTimeToZoned("2026-08-07", "19:00", "UTC"),
    durationMinutes: 60,
  },
  recurrence: { rrule: "FREQ=WEEKLY;COUNT=4", excludedStarts: [] },
  color: "mint",
};

describe("LocalCalendarService mutation scopes", () => {
  let service: LocalCalendarService;

  beforeEach(() => {
    window.localStorage.clear();
    service = LocalCalendarService.open("UTC").service;
  });

  afterEach(() => service?.dispose());

  it("creates an override when one occurrence is edited", async () => {
    const event = await service.createEvent(input);
    const occurrences = await service.listOccurrences({
      from: "2026-08-01",
      to: "2026-09-30",
    });
    const second = occurrences[1];

    await service.updateEvent(
      { eventId: event.id, occurrenceStart: second.occurrenceStart },
      "occurrence",
      { title: "Long swim" },
    );

    const updated = await service.listOccurrences({
      from: second.dateKeys[0],
      to: second.dateKeys[0],
    });
    expect(updated).toHaveLength(1);
    expect(updated[0].record.title).toBe("Long swim");
    expect(updated[0].isOverride).toBe(true);
    expect(updated[0].record.recurrence).toBeNull();
  });

  it("removes only future occurrences when deleting following", async () => {
    const event = await service.createEvent(input);
    const occurrences = await service.listOccurrences({
      from: "2026-08-01",
      to: "2026-09-30",
    });

    await service.deleteEvent(
      { eventId: event.id, occurrenceStart: occurrences[2].occurrenceStart },
      "following",
    );

    const remaining = await service.listOccurrences({
      from: "2026-08-01",
      to: "2026-09-30",
    });
    expect(remaining.map((item) => item.dateKeys[0])).toEqual([
      "2026-08-07",
      "2026-08-14",
    ]);
  });

  it("splits following edits while retaining the series occurrence count", async () => {
    await service.createEvent(input);
    const occurrences = await service.listOccurrences({
      from: "2026-08-01",
      to: "2026-09-30",
    });

    await service.updateEvent(
      {
        eventId: occurrences[1].eventId,
        occurrenceStart: occurrences[1].occurrenceStart,
      },
      "following",
      { title: "Evening swim" },
    );

    const updated = await service.listOccurrences({
      from: "2026-08-01",
      to: "2026-09-30",
    });
    expect(updated.map((item) => item.dateKeys[0])).toEqual([
      "2026-08-07",
      "2026-08-14",
      "2026-08-21",
      "2026-08-28",
    ]);
    expect(updated.map((item) => item.record.title)).toEqual([
      "Swim",
      "Evening swim",
      "Evening swim",
      "Evening swim",
    ]);
  });

  it("preserves overrides and the original schedule for series metadata edits", async () => {
    const event = await service.createEvent(input);
    const occurrences = await service.listOccurrences({
      from: "2026-08-01",
      to: "2026-09-30",
    });
    await service.updateEvent(
      { eventId: event.id, occurrenceStart: occurrences[1].occurrenceStart },
      "occurrence",
      { title: "Long swim" },
    );
    const withOverride = await service.listOccurrences({
      from: "2026-08-01",
      to: "2026-09-30",
    });
    const override = withOverride.find((item) => item.isOverride);
    const originalTiming = service.getDocument().events.find(
      (item) => item.id === event.id,
    )?.timing;

    await service.updateEvent(
      {
        eventId: override?.eventId ?? "",
        occurrenceStart: override?.occurrenceStart ?? "",
      },
      "series",
      { location: "Municipal pool" },
    );

    const document = service.getDocument();
    const base = document.events.find((item) => item.id === event.id);
    expect(base?.timing).toEqual(originalTiming);
    expect(base?.location).toBe("Municipal pool");
    expect(document.events.find((item) => item.seriesId === event.id)?.title).toBe(
      "Long swim",
    );
  });

  it("changes a series time without moving its original anchor date", async () => {
    const event = await service.createEvent(input);
    const occurrences = await service.listOccurrences({
      from: "2026-08-01",
      to: "2026-09-30",
    });
    const selected = occurrences[2];

    await service.updateEvent(
      {
        eventId: selected.eventId,
        occurrenceStart: selected.occurrenceStart,
      },
      "series",
      {
        timing: {
          kind: "timed",
          startsAt: localDateTimeToZoned(
            selected.dateKeys[0],
            "20:30",
            "UTC",
          ),
          durationMinutes: 90,
        },
      },
    );

    const base = service.getDocument().events.find(
      (item) => item.id === event.id,
    );
    expect(base?.timing.kind).toBe("timed");
    if (base?.timing.kind !== "timed") throw new Error("Expected timed event.");
    expect(dateValueFromZoned(base.timing.startsAt)).toBe("2026-08-07");
    expect(timeValueFromZoned(base.timing.startsAt)).toBe("20:30");
    expect(base.timing.durationMinutes).toBe(90);
    expect(
      (
        await service.listOccurrences({
          from: "2026-08-01",
          to: "2026-09-30",
        })
      ).map((item) => item.dateKeys[0]),
    ).toEqual([
      "2026-08-07",
      "2026-08-14",
      "2026-08-21",
      "2026-08-28",
    ]);
  });

  it("removes exceptions when the entire recurrence pattern changes", async () => {
    const event = await service.createEvent(input);
    const occurrences = await service.listOccurrences({
      from: "2026-08-01",
      to: "2026-09-30",
    });
    await service.updateEvent(
      { eventId: event.id, occurrenceStart: occurrences[1].occurrenceStart },
      "occurrence",
      { title: "Long swim" },
    );

    await service.updateEvent(
      { eventId: event.id, occurrenceStart: occurrences[0].occurrenceStart },
      "series",
      {
        recurrence: {
          rrule: "FREQ=DAILY;COUNT=2",
          excludedStarts: [occurrences[1].occurrenceStart],
        },
      },
    );

    const document = service.getDocument();
    expect(document.events).toHaveLength(1);
    expect(document.events[0].recurrence).toEqual({
      rrule: "FREQ=DAILY;COUNT=2",
      excludedStarts: [],
    });
  });

  it("deletes one occurrence or the entire series according to scope", async () => {
    const event = await service.createEvent(input);
    const occurrences = await service.listOccurrences({
      from: "2026-08-01",
      to: "2026-09-30",
    });

    await service.deleteEvent(
      { eventId: event.id, occurrenceStart: occurrences[1].occurrenceStart },
      "occurrence",
    );
    const afterOccurrenceDelete = await service.listOccurrences({
      from: "2026-08-01",
      to: "2026-09-30",
    });
    expect(afterOccurrenceDelete).toHaveLength(3);
    expect(afterOccurrenceDelete.map((item) => item.dateKeys[0])).not.toContain(
      "2026-08-14",
    );

    await service.deleteEvent(
      {
        eventId: afterOccurrenceDelete[0].eventId,
        occurrenceStart: afterOccurrenceDelete[0].occurrenceStart,
      },
      "series",
    );
    expect(
      await service.listOccurrences({
        from: "2026-08-01",
        to: "2026-09-30",
      }),
    ).toEqual([]);
  });

  it("accepts only the highest-revision update from another tab", async () => {
    const unsubscribe = service.subscribe(() => undefined);
    await service.createEvent({ ...input, recurrence: null });
    const current = service.getDocument();
    const newer = {
      version: 1 as const,
      revision: current.revision + 1,
      updatedAt: "2030-01-01T00:00:00.000Z",
      events: [],
    };

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: EVENTS_STORAGE_KEY,
        newValue: JSON.stringify(newer),
      }),
    );
    expect(service.getDocument()).toEqual(newer);

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: EVENTS_STORAGE_KEY,
        newValue: JSON.stringify(current),
      }),
    );
    expect(service.getDocument()).toEqual(newer);
    unsubscribe();
  });
});
