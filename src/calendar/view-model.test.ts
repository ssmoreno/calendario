import { describe, expect, it } from "vitest";

import {
  filterOccurrences,
  groupOccupiedDates,
  layoutTimedEvents,
} from "./view-model";
import { addDays, monthGridRange, startOfWeek, weekRange } from "./date-time";
import type { EventRecord, Occurrence } from "./types";

function occurrence(
  id: string,
  title: string,
  dateKeys: string[],
  options: {
    allDay?: boolean;
    startsAt?: string;
    durationMinutes?: number;
    recurrence?: boolean;
    location?: string;
    notes?: string;
  } = {},
): Occurrence {
  const now = "2026-01-01T00:00:00.000Z";
  const timing = options.allDay
    ? {
        kind: "all-day" as const,
        startDate: dateKeys[0],
        endDateExclusive: addDays(dateKeys.at(-1) ?? dateKeys[0], 1),
      }
    : {
        kind: "timed" as const,
        startsAt: options.startsAt ?? `${dateKeys[0]}T09:00:00+00:00[UTC]`,
        durationMinutes: options.durationMinutes ?? 60,
      };
  const record: EventRecord = {
    id,
    title,
    timing,
    recurrence: options.recurrence
      ? { rrule: "FREQ=DAILY", excludedStarts: [] }
      : null,
    location: options.location,
    notes: options.notes,
    color: "coral",
    createdAt: now,
    updatedAt: now,
  };
  return {
    key: `${id}:${dateKeys[0]}`,
    eventId: id,
    rootEventId: id,
    occurrenceStart:
      timing.kind === "timed" ? timing.startsAt : timing.startDate,
    record,
    timing,
    dateKeys,
    isOverride: false,
  };
}

describe("calendar view model", () => {
  it("builds Monday-first week and month ranges", () => {
    expect(startOfWeek("2026-08-09")).toBe("2026-08-03");
    expect(weekRange("2026-08-09")).toEqual({
      from: "2026-08-03",
      to: "2026-08-09",
    });
    expect(monthGridRange("2026-08-15")).toEqual({
      from: "2026-07-27",
      to: "2026-09-06",
    });
    expect(weekRange("2027-01-01")).toEqual({
      from: "2026-12-28",
      to: "2027-01-03",
    });
  });

  it("groups only occupied dates and sorts all-day events before timed events", () => {
    const groups = groupOccupiedDates([
      occurrence("late", "Late", ["2026-08-10"], {
        startsAt: "2026-08-10T18:00:00+00:00[UTC]",
      }),
      occurrence("all-day", "Milestone", ["2026-08-10"], { allDay: true }),
      occurrence("early", "Early", ["2026-08-10"], {
        startsAt: "2026-08-10T08:00:00+00:00[UTC]",
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].segments.map((segment) => segment.occurrence.eventId)).toEqual([
      "all-day",
      "early",
      "late",
    ]);
  });

  it("marks each segment of a multi-day event", () => {
    const [groupOne, groupTwo, groupThree] = groupOccupiedDates([
      occurrence("trip", "Trip", ["2026-08-11", "2026-08-12", "2026-08-13"], {
        allDay: true,
      }),
    ]);

    expect(groupOne.segments[0].dayPosition).toBe("start");
    expect(groupTwo.segments[0].dayPosition).toBe("middle");
    expect(groupThree.segments[0].dayPosition).toBe("end");
  });

  it("sorts equal starts by end time and then title", () => {
    const groups = groupOccupiedDates([
      occurrence("long", "Long", ["2026-08-10"], { durationMinutes: 90 }),
      occurrence("short-b", "Bravo", ["2026-08-10"], {
        durationMinutes: 30,
      }),
      occurrence("short-a", "Alpha", ["2026-08-10"], {
        durationMinutes: 30,
      }),
    ]);

    expect(groups[0].segments.map((segment) => segment.occurrence.eventId)).toEqual([
      "short-a",
      "short-b",
      "long",
    ]);
  });

  it("lays overlapping timed events into reusable columns", () => {
    const groups = groupOccupiedDates([
      occurrence("early", "Early", ["2026-08-10"], {
        startsAt: "2026-08-10T09:00:00+00:00[UTC]",
        durationMinutes: 120,
      }),
      occurrence("overlap", "Overlap", ["2026-08-10"], {
        startsAt: "2026-08-10T09:30:00+00:00[UTC]",
        durationMinutes: 30,
      }),
      occurrence("later", "Later", ["2026-08-10"], {
        startsAt: "2026-08-10T10:00:00+00:00[UTC]",
        durationMinutes: 30,
      }),
    ]);

    expect(
      layoutTimedEvents(groups[0].segments, "UTC").map((item) => ({
        id: item.segment.occurrence.eventId,
        start: item.startMinute,
        end: item.endMinute,
        column: item.column,
        columnCount: item.columnCount,
      })),
    ).toEqual([
      { id: "early", start: 540, end: 660, column: 0, columnCount: 2 },
      { id: "overlap", start: 570, end: 600, column: 1, columnCount: 2 },
      { id: "later", start: 600, end: 630, column: 1, columnCount: 2 },
    ]);
  });

  it("segments overnight events and excludes all-day events from timed layout", () => {
    const [firstDay, secondDay] = groupOccupiedDates([
      occurrence("overnight", "Overnight", ["2026-08-10", "2026-08-11"], {
        startsAt: "2026-08-10T23:30:00+00:00[UTC]",
        durationMinutes: 120,
      }),
      occurrence("all-day", "All day", ["2026-08-10"], { allDay: true }),
    ]);

    expect(layoutTimedEvents(firstDay.segments, "UTC")).toMatchObject([
      { startMinute: 1_410, endMinute: 1_440 },
    ]);
    expect(layoutTimedEvents(secondDay.segments, "UTC")).toMatchObject([
      { startMinute: 0, endMinute: 90 },
    ]);
  });

  it("returns one next match for a recurring series when searching", () => {
    const results = filterOccurrences(
      [
        occurrence("swim", "Swim", ["2026-08-01"], { recurrence: true }),
        occurrence("swim", "Swim", ["2026-08-08"], { recurrence: true }),
        occurrence("swim", "Swim", ["2026-08-15"], { recurrence: true }),
      ],
      "swim",
      "2026-08-06",
    );

    expect(results).toHaveLength(1);
    expect(results[0].dateKeys[0]).toBe("2026-08-08");
  });

  it("searches location and notes and keeps independent events", () => {
    const results = filterOccurrences(
      [
        occurrence("place", "Lunch", ["2026-08-08"], {
          location: "Recoleta",
        }),
        occurrence("notes", "Call", ["2026-08-09"], {
          notes: "Ask about Recoleta venue",
        }),
        occurrence("other", "Swim", ["2026-08-10"]),
      ],
      "recoleta",
    );

    expect(results.map((item) => item.eventId)).toEqual(["place", "notes"]);
  });
});
