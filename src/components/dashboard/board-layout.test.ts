import { describe, expect, it } from "vitest";

import type { UpcomingEvent } from "@/server/google-calendar";

import { groupByDay } from "./board-layout";

const NOW = new Date("2026-09-01T15:00:00Z");

function timed(id: string, startsAt: string, timeZone = "UTC"): UpcomingEvent {
  return {
    id,
    title: id,
    timing: { kind: "timed", startsAt, endsAt: startsAt, timeZone },
    color: "ultramarine",
    reminderMinutes: [],
    usesDefaultReminder: false,
  };
}

function allDay(
  id: string,
  startDate: string,
  endDateExclusive: string,
): UpcomingEvent {
  return {
    id,
    title: id,
    timing: { kind: "all-day", startDate, endDateExclusive },
    color: "gold",
    reminderMinutes: [],
    usesDefaultReminder: false,
  };
}

describe("groupByDay", () => {
  it("keys a timed event on the viewer's day", () => {
    const event = timed(
      "late",
      "2026-09-02T02:30:00.000Z",
      "America/Argentina/Buenos_Aires",
    );

    const inBuenosAires = groupByDay(
      [event],
      "America/Argentina/Buenos_Aires",
      NOW,
    );
    const inUtc = groupByDay([event], "UTC", NOW);

    expect(inBuenosAires[0].dateKey).toBe("2026-09-01");
    expect(inUtc[0].dateKey).toBe("2026-09-02");
  });

  it("clamps an all-day event already underway forward to today", () => {
    const sections = groupByDay(
      [allDay("trip", "2026-08-30", "2026-09-04")],
      "UTC",
      NOW,
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].dateKey).toBe("2026-09-01");
  });

  it("orders days and puts all-day events first", () => {
    const sections = groupByDay(
      [
        timed("later-day", "2026-09-03T09:00:00.000Z"),
        timed("standup", "2026-09-01T09:00:00.000Z"),
        allDay("holiday", "2026-09-01", "2026-09-02"),
      ],
      "UTC",
      NOW,
    );

    expect(sections.map((day) => day.dateKey)).toEqual([
      "2026-09-01",
      "2026-09-03",
    ]);
    expect(sections[0].events.map((event) => event.id)).toEqual([
      "holiday",
      "standup",
    ]);
  });
});
