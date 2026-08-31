import { describe, expect, it } from "vitest";

import type { UpcomingEvent } from "@/server/google-calendar";

import {
  BLOCK_GAP,
  COLUMN_GAP,
  BLOCK_HEIGHT,
  DAY_HEADER_GAP,
  DAY_HEADER_HEIGHT,
  MIN_COLUMN_WIDTH,
  SECTION_GAP,
  chooseColumnCount,
  groupByDay,
  packColumns,
  sectionHeight,
  type DaySection,
} from "./board-layout";

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

function allDay(id: string, startDate: string, endDateExclusive: string): UpcomingEvent {
  return {
    id,
    title: id,
    timing: { kind: "all-day", startDate, endDateExclusive },
    color: "gold",
    reminderMinutes: [],
    usesDefaultReminder: false,
  };
}

/** A day of `count` events, for packing tests that do not care about content. */
function section(dateKey: string, count: number): DaySection {
  return {
    dateKey,
    events: Array.from({ length: count }, (_, index) =>
      timed(`${dateKey}-${index}`, `${dateKey}T10:00:00.000Z`),
    ),
    hiddenCount: 0,
  };
}

/** A column tall enough for exactly `count` blocks under one heading. */
function heightFor(count: number) {
  return sectionHeight(count);
}

describe("groupByDay", () => {
  it("keys a timed event on the viewer's day, not the event's own zone", () => {
    // 11pm in Buenos Aires is already the 2nd in UTC.
    const event = timed(
      "late",
      "2026-09-02T02:30:00.000Z",
      "America/Argentina/Buenos_Aires",
    );

    const inBuenosAires = groupByDay([event], "America/Argentina/Buenos_Aires", NOW);
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

  it("orders days forward and puts all-day events at the head of their day", () => {
    const sections = groupByDay(
      [
        timed("later-day", "2026-09-03T09:00:00.000Z"),
        timed("standup", "2026-09-01T09:00:00.000Z"),
        allDay("holiday", "2026-09-01", "2026-09-02"),
      ],
      "UTC",
      NOW,
    );

    expect(sections.map((day) => day.dateKey)).toEqual(["2026-09-01", "2026-09-03"]);
    expect(sections[0].events.map((event) => event.id)).toEqual(["holiday", "standup"]);
  });
});

describe("packColumns", () => {
  it("spreads the days over its columns rather than filling the first", () => {
    const sections = [section("2026-09-01", 2), section("2026-09-02", 2)];
    // Both days would fit in one column; two shallow columns read better.
    const columnHeight = sectionHeight(2) + SECTION_GAP + sectionHeight(2);

    const layout = packColumns(sections, { columnCount: 3, columnHeight });

    expect(layout.columns.map((column) => column.length)).toEqual([1, 1]);
    expect(layout.hiddenEvents).toBe(0);
  });

  it("keeps the days in order across the columns it spreads them over", () => {
    const sections = Array.from({ length: 9 }, (_, index) =>
      section(`2026-09-0${index + 1}`, 3),
    );

    const layout = packColumns(sections, {
      columnCount: 5,
      // Room for two days a column, so nine days need every one of the five.
      columnHeight: sectionHeight(3) * 2 + SECTION_GAP,
    });

    expect(layout.columns.map((column) => column.length)).toEqual([2, 2, 2, 2, 1]);
    expect(layout.columns.flat().map((day) => day.dateKey)).toEqual(
      sections.map((day) => day.dateKey),
    );
    expect(layout.hiddenEvents).toBe(0);
  });

  it("leaves no column empty when one busy day takes a whole column", () => {
    const sections = [
      section("2026-09-01", 12),
      section("2026-09-02", 2),
      section("2026-09-03", 2),
      section("2026-09-04", 2),
    ];

    const layout = packColumns(sections, {
      columnCount: 3,
      columnHeight: heightFor(9),
    });

    expect(layout.columns.map((column) => column.length)).toEqual([1, 2, 1]);
    expect(layout.columns[0][0].hiddenCount).toBeGreaterThan(0);
  });

  it("moves a day that no longer fits into the next column", () => {
    const sections = [section("2026-09-01", 2), section("2026-09-02", 2)];

    const layout = packColumns(sections, {
      columnCount: 3,
      columnHeight: sectionHeight(3),
    });

    expect(layout.columns.map((column) => column.length)).toEqual([1, 1]);
    expect(layout.hiddenEvents).toBe(0);
    expect(layout.lastVisibleDay).toBe("2026-09-02");
  });

  it("gives a day taller than a column that column to itself and trims the rest", () => {
    const sections = [section("2026-09-01", 12), section("2026-09-02", 1)];

    const layout = packColumns(sections, {
      columnCount: 3,
      columnHeight: heightFor(5),
    });

    expect(layout.columns[0]).toHaveLength(1);
    // Four blocks, not five: the fifth slot carries the "+8 more" line.
    expect(layout.columns[0][0].events).toHaveLength(4);
    expect(layout.columns[0][0].hiddenCount).toBe(8);
    expect(layout.hiddenEvents).toBe(8);
    // The next day still gets drawn, in the column after it.
    expect(layout.columns[1][0].dateKey).toBe("2026-09-02");
  });

  it("drops the days past the last column and counts them", () => {
    const sections = [
      section("2026-09-01", 3),
      section("2026-09-02", 3),
      section("2026-09-03", 2),
    ];

    const layout = packColumns(sections, {
      columnCount: 2,
      columnHeight: heightFor(3),
    });

    expect(layout.columns).toHaveLength(2);
    expect(layout.hiddenDays).toBe(1);
    expect(layout.hiddenEvents).toBe(2);
    expect(layout.lastVisibleDay).toBe("2026-09-02");
  });

});

describe("chooseColumnCount", () => {
  const wide = { width: MIN_COLUMN_WIDTH * 9, height: heightFor(4) };

  it("rests at three columns when three are enough", () => {
    const sections = [section("2026-09-01", 4), section("2026-09-02", 4)];

    expect(chooseColumnCount(sections, wide)).toBe(3);
  });

  it("widens past three only as far as it must to draw every day", () => {
    const sections = Array.from({ length: 5 }, (_, index) =>
      section(`2026-09-0${index + 1}`, 4),
    );

    expect(chooseColumnCount(sections, wide)).toBe(5);
  });

  it("does not widen for a day no column could hold anyway", () => {
    // One day too tall for any column, and three that fit beside it.
    const sections = [
      section("2026-09-01", 40),
      section("2026-09-02", 2),
      section("2026-09-03", 2),
    ];

    expect(chooseColumnCount(sections, wide)).toBe(3);
  });

  it("stops at seven columns however much is scheduled", () => {
    const sections = Array.from({ length: 15 }, (_, index) =>
      section(`2026-09-${String(index + 1).padStart(2, "0")}`, 4),
    );

    expect(chooseColumnCount(sections, wide)).toBe(7);
  });

  it("never asks for more columns than the width can carry", () => {
    const sections = Array.from({ length: 8 }, (_, index) =>
      section(`2026-09-0${index + 1}`, 4),
    );

    expect(
      chooseColumnCount(sections, { width: MIN_COLUMN_WIDTH * 2 + COLUMN_GAP, height: heightFor(4) }),
    ).toBe(2);
    expect(chooseColumnCount(sections, { width: 320, height: heightFor(4) })).toBe(1);
  });
});

describe("sectionHeight", () => {
  it("counts the heading, the blocks, and the gaps between them", () => {
    expect(sectionHeight(3)).toBe(
      DAY_HEADER_HEIGHT + DAY_HEADER_GAP + 3 * BLOCK_HEIGHT + 2 * BLOCK_GAP,
    );
  });
});
