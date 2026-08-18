import { describe, expect, it } from "vitest";

import {
  changeCalendarTimeZone,
  initialCalendarSessionState,
} from "./calendar-session";

describe("Eve calendar session state", () => {
  it("starts without a configured timezone", () => {
    expect(initialCalendarSessionState()).toEqual({ timeZone: null });
  });

  it("changes the session timezone", () => {
    const configured = changeCalendarTimeZone(
      initialCalendarSessionState(),
      "Europe/Madrid",
    );
    const changed = changeCalendarTimeZone(
      configured,
      "America/Argentina/Buenos_Aires",
    );

    expect(changed).toEqual({
      timeZone: "America/Argentina/Buenos_Aires",
    });
  });
});
