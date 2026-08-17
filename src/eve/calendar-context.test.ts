import { describe, expect, it } from "vitest";

import { emptyCalendar } from "@/calendar/storage";

import { buildCalendarContext, currentCalendarTime } from "./calendar-context";

describe("Eve calendar context", () => {
  it("requires timezone setup before date interpretation", () => {
    expect(
      buildCalendarContext({ timeZone: null, document: emptyCalendar() }),
    ).toContain("timezone is not configured");
  });

  it("describes the current date and time in the saved timezone", () => {
    const context = buildCalendarContext(
      {
        timeZone: "America/Argentina/Buenos_Aires",
        document: emptyCalendar(),
      },
      new Date("2026-08-13T15:45:00.000Z"),
    );

    expect(context).toContain("Thursday, 2026-08-13");
    expect(context).toContain("12:45");
    expect(context).toContain("America/Argentina/Buenos_Aires");
  });

  it("returns structured current-time context for timezone setup", () => {
    expect(
      currentCalendarTime(
        "America/Argentina/Buenos_Aires",
        new Date("2026-08-13T15:45:00.000Z"),
      ),
    ).toEqual({
      timeZone: "America/Argentina/Buenos_Aires",
      today: "2026-08-13",
      weekday: "Thursday",
      localTime: "12:45",
    });
  });
});
