import { describe, expect, it } from "vitest";

import {
  formatDuration,
  formatTime,
  isDateKey,
  localDateTimeToZoned,
  monthRange,
  timingDateKeys,
} from "./date-time";

describe("calendar date and time handling", () => {
  it("places overnight events in every intersected viewer date", () => {
    const startsAt = localDateTimeToZoned("2026-08-08", "23:30", "UTC");

    expect(
      timingDateKeys(
        { kind: "timed", startsAt, durationMinutes: 120 },
        "UTC",
      ),
    ).toEqual(["2026-08-08", "2026-08-09"]);
  });

  it("converts timed dates into the viewer timezone", () => {
    const startsAt = localDateTimeToZoned(
      "2026-08-08",
      "23:30",
      "America/New_York",
    );

    expect(
      timingDateKeys(
        { kind: "timed", startsAt, durationMinutes: 60 },
        "Europe/London",
      ),
    ).toEqual(["2026-08-09"]);
  });

  it("uses locale-specific 12-hour and 24-hour clocks", () => {
    const startsAt = localDateTimeToZoned("2026-08-08", "19:00", "UTC");

    expect(formatTime(startsAt, "en-US", "UTC")).toMatch(/7:00\sPM/i);
    expect(formatTime(startsAt, "en-GB", "UTC")).toBe("19:00");
  });

  it("rejects impossible calendar dates", () => {
    expect(isDateKey("2028-02-29")).toBe(true);
    expect(isDateKey("2026-02-29")).toBe(false);
    expect(isDateKey("08/08/2026")).toBe(false);
  });

  it("finds exact month bounds across leap years", () => {
    expect(monthRange("2028-02-15")).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
  });

  it("formats compact minute, hour, and multi-day durations", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(90)).toBe("1 hr 30 min");
    expect(formatDuration(1_440)).toBe("1 day");
    expect(formatDuration(3_030)).toBe("2 days 2 hr 30 min");
  });
});
