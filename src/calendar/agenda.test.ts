import { describe, expect, it } from "vitest";

import {
  buildTimeline,
  filterOccurrences,
  groupOccupiedDates,
} from "./agenda";
import { addDays } from "./date-time";
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

describe("occupied date agenda", () => {
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

  it("omits dividers for consecutive dates and reports exact quiet ranges", () => {
    const groups = groupOccupiedDates([
      occurrence("one", "One", ["2026-08-01"]),
      occurrence("two", "Two", ["2026-08-02"]),
      occurrence("three", "Three", ["2026-08-10"]),
    ]);
    const timeline = buildTimeline(groups, "2026-08-01");

    expect(timeline.map((item) => item.kind)).toEqual([
      "date",
      "date",
      "quiet",
      "date",
    ]);
    expect(timeline[2]).toMatchObject({
      count: 7,
      from: "2026-08-03",
      to: "2026-08-09",
    });
  });

  it("splits a quiet interval around an empty Today", () => {
    const groups = groupOccupiedDates([
      occurrence("past", "Past", ["2026-08-01"]),
      occurrence("future", "Future", ["2026-08-10"]),
    ]);
    const timeline = buildTimeline(groups, "2026-08-06");

    expect(timeline.map((item) => item.kind)).toEqual([
      "date",
      "quiet",
      "today",
      "quiet",
      "date",
    ]);
    expect(timeline[1]).toMatchObject({ count: 4, from: "2026-08-02", to: "2026-08-05" });
    expect(timeline[3]).toMatchObject({ count: 3, from: "2026-08-07", to: "2026-08-09" });
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
