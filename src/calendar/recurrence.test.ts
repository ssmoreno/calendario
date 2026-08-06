import { describe, expect, it } from "vitest";

import { localDateTimeToZoned, zonedTimestampParts } from "./date-time";
import { expandEvent, truncateRuleBefore } from "./recurrence";
import type { EventRecord } from "./types";

function recurringEvent(
  startDate: string,
  rule: string,
  options: { timeZone?: string; time?: string; excludedStarts?: string[] } = {},
): EventRecord {
  const timeZone = options.timeZone ?? "UTC";
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: `event-${rule}`,
    title: "Recurring",
    timing: {
      kind: "timed",
      startsAt: localDateTimeToZoned(
        startDate,
        options.time ?? "09:00",
        timeZone,
      ),
      durationMinutes: 60,
    },
    recurrence: {
      rrule: rule,
      excludedStarts: options.excludedStarts ?? [],
    },
    color: "coral",
    createdAt: now,
    updatedAt: now,
  };
}

describe("recurrence expansion", () => {
  it("supports custom daily intervals and occurrence counts", () => {
    const event = recurringEvent(
      "2026-08-01",
      "FREQ=DAILY;INTERVAL=2;COUNT=3",
    );
    const dates = expandEvent(
      event,
      { from: "2026-08-01", to: "2026-08-10" },
      "UTC",
    ).map((item) => item.dateKeys[0]);

    expect(dates).toEqual(["2026-08-01", "2026-08-03", "2026-08-05"]);
  });

  it("supports weekday and selected-weekday rules", () => {
    const weekdays = recurringEvent(
      "2026-08-01",
      "FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=5",
    );
    const selected = recurringEvent(
      "2026-08-04",
      "FREQ=WEEKLY;BYDAY=TU,TH;COUNT=4",
    );
    const range = { from: "2026-08-01", to: "2026-08-20" };

    expect(expandEvent(weekdays, range, "UTC").map((item) => item.dateKeys[0])).toEqual([
      "2026-08-03",
      "2026-08-05",
      "2026-08-07",
      "2026-08-10",
      "2026-08-12",
    ]);
    expect(expandEvent(selected, range, "UTC").map((item) => item.dateKeys[0])).toEqual([
      "2026-08-04",
      "2026-08-06",
      "2026-08-11",
      "2026-08-13",
    ]);
  });

  it("supports monthly ordinal weekdays", () => {
    const event = recurringEvent(
      "2026-08-14",
      "FREQ=MONTHLY;BYDAY=2FR;COUNT=3",
    );
    const dates = expandEvent(
      event,
      { from: "2026-08-01", to: "2026-11-01" },
      "UTC",
    ).map((item) => item.dateKeys[0]);

    expect(dates).toEqual(["2026-08-14", "2026-09-11", "2026-10-09"]);
  });

  it("honors an inclusive recurrence end date", () => {
    const event = recurringEvent(
      "2026-08-01",
      "FREQ=DAILY;UNTIL=20260803T235959Z",
    );
    const dates = expandEvent(
      event,
      { from: "2026-08-01", to: "2026-08-10" },
      "UTC",
    ).map((item) => item.dateKeys[0]);

    expect(dates).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
  });

  it("skips months that do not contain the requested date", () => {
    const event = recurringEvent("2026-01-31", "FREQ=MONTHLY;BYMONTHDAY=31");
    const dates = expandEvent(
      event,
      { from: "2026-01-01", to: "2026-04-30" },
      "UTC",
    ).map((item) => item.dateKeys[0]);

    expect(dates).toEqual(["2026-01-31", "2026-03-31"]);
  });

  it("keeps leap-day yearly events on leap years", () => {
    const event = recurringEvent(
      "2024-02-29",
      "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29",
    );
    const dates = expandEvent(
      event,
      { from: "2024-01-01", to: "2030-12-31" },
      "UTC",
    ).map((item) => item.dateKeys[0]);

    expect(dates).toEqual(["2024-02-29", "2028-02-29"]);
  });

  it("retains wall-clock time through a daylight-saving transition", () => {
    const event = recurringEvent("2026-03-01", "FREQ=WEEKLY;COUNT=3", {
      timeZone: "America/New_York",
      time: "09:00",
    });
    const occurrences = expandEvent(
      event,
      { from: "2026-03-01", to: "2026-03-20" },
      "America/New_York",
    );

    expect(occurrences).toHaveLength(3);
    expect(
      occurrences.map((item) =>
        zonedTimestampParts(
          item.timing.kind === "timed" ? item.timing.startsAt : "",
        ).hour,
      ),
    ).toEqual([9, 9, 9]);
    expect(
      occurrences.map((item) =>
        item.timing.kind === "timed" ? item.timing.startsAt : "",
      ),
    ).toEqual([
      expect.stringContaining("-05:00"),
      expect.stringContaining("-04:00"),
      expect.stringContaining("-04:00"),
    ]);
  });

  it("omits explicitly excluded starts", () => {
    const excluded = localDateTimeToZoned("2026-08-08", "09:00", "UTC");
    const event = recurringEvent("2026-08-01", "FREQ=WEEKLY;COUNT=3", {
      excludedStarts: [excluded],
    });
    const dates = expandEvent(
      event,
      { from: "2026-08-01", to: "2026-08-31" },
      "UTC",
    ).map((item) => item.dateKeys[0]);

    expect(dates).toEqual(["2026-08-01", "2026-08-15"]);
  });

  it("preserves multi-day duration for recurring all-day events", () => {
    const now = "2026-01-01T00:00:00.000Z";
    const event: EventRecord = {
      id: "retreat",
      title: "Retreat",
      timing: {
        kind: "all-day",
        startDate: "2026-08-01",
        endDateExclusive: "2026-08-04",
      },
      recurrence: { rrule: "FREQ=WEEKLY;COUNT=2", excludedStarts: [] },
      color: "gold",
      createdAt: now,
      updatedAt: now,
    };

    const occurrences = expandEvent(
      event,
      { from: "2026-08-01", to: "2026-08-15" },
      "UTC",
    );

    expect(occurrences.map((item) => item.dateKeys)).toEqual([
      ["2026-08-01", "2026-08-02", "2026-08-03"],
      ["2026-08-08", "2026-08-09", "2026-08-10"],
    ]);
  });

  it("includes a long recurring event that began before the requested range", () => {
    const now = "2026-01-01T00:00:00.000Z";
    const event: EventRecord = {
      id: "long-retreat",
      title: "Long retreat",
      timing: {
        kind: "all-day",
        startDate: "2026-08-01",
        endDateExclusive: "2026-08-08",
      },
      recurrence: { rrule: "FREQ=WEEKLY;COUNT=1", excludedStarts: [] },
      color: "gold",
      createdAt: now,
      updatedAt: now,
    };

    const occurrences = expandEvent(
      event,
      { from: "2026-08-06", to: "2026-08-06" },
      "UTC",
    );

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].dateKeys).toContain("2026-08-06");
  });

  it("splits count-limited rules without losing the target occurrence", () => {
    const event = recurringEvent(
      "2026-08-01",
      "FREQ=WEEKLY;COUNT=4",
    );
    const target = localDateTimeToZoned("2026-08-15", "09:00", "UTC");

    const split = truncateRuleBefore(
      event.recurrence?.rrule ?? "",
      event,
      target,
    );

    expect(split.originalRule).toContain("COUNT=2");
    expect(split.followingRule).toContain("COUNT=2");
  });
});
