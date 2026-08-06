import { describe, expect, it } from "vitest";

import { localDateTimeToZoned } from "./date-time";
import { eventInputSchema, timeZoneSchema } from "./schemas";
import type { EventInput } from "./types";

const validInput: EventInput = {
  title: "Dinner",
  timing: {
    kind: "timed",
    startsAt: localDateTimeToZoned("2026-08-08", "19:00", "UTC"),
    durationMinutes: 60,
  },
  recurrence: null,
  color: "coral",
};

describe("event validation", () => {
  it("requires a trimmed title and a positive timed duration", () => {
    expect(eventInputSchema.safeParse({ ...validInput, title: "   " }).success).toBe(
      false,
    );
    expect(
      eventInputSchema.safeParse({
        ...validInput,
        timing: { ...validInput.timing, durationMinutes: 0 },
      }).success,
    ).toBe(false);
  });

  it("requires an all-day end after its start", () => {
    expect(
      eventInputSchema.safeParse({
        ...validInput,
        timing: {
          kind: "all-day",
          startDate: "2026-08-08",
          endDateExclusive: "2026-08-08",
        },
      }).success,
    ).toBe(false);
  });

  it("rejects recurrence endings before the event start", () => {
    expect(
      eventInputSchema.safeParse({
        ...validInput,
        recurrence: {
          rrule: "FREQ=DAILY;UNTIL=20260807T235959Z",
          excludedStarts: [],
        },
      }).success,
    ).toBe(false);
  });

  it("requires recurrence exclusions to match timed or all-day starts", () => {
    expect(
      eventInputSchema.safeParse({
        ...validInput,
        recurrence: {
          rrule: "FREQ=DAILY;COUNT=2",
          excludedStarts: ["2026-08-09"],
        },
      }).success,
    ).toBe(false);
    expect(
      eventInputSchema.safeParse({
        ...validInput,
        timing: {
          kind: "all-day",
          startDate: "2026-08-08",
          endDateExclusive: "2026-08-09",
        },
        recurrence: {
          rrule: "FREQ=DAILY;COUNT=2",
          excludedStarts: ["2026-08-09T00:00:00+00:00[UTC]"],
        },
      }).success,
    ).toBe(false);
  });

  it("requires timezone-aware timestamps and valid IANA timezones", () => {
    expect(
      eventInputSchema.safeParse({
        ...validInput,
        timing: {
          kind: "timed",
          startsAt: "2026-08-08T19:00:00",
          durationMinutes: 60,
        },
      }).success,
    ).toBe(false);
    expect(timeZoneSchema.safeParse("America/Argentina/Buenos_Aires").success).toBe(
      true,
    );
    expect(timeZoneSchema.safeParse("Mars/Olympus_Mons").success).toBe(false);
  });
});
