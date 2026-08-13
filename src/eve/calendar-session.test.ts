import { describe, expect, it } from "vitest";

import {
  changeCalendarTimeZone,
  createCalendarSessionRuntime,
  initialCalendarSessionState,
} from "./calendar-session";

describe("Eve calendar session state", () => {
  it("fails calendar access clearly until a timezone is configured", () => {
    expect(() =>
      createCalendarSessionRuntime(initialCalendarSessionState()),
    ).toThrow(/call set_time_zone/);
  });

  it("changes timezone without replacing the durable calendar document", () => {
    const configured = changeCalendarTimeZone(
      initialCalendarSessionState(),
      "Europe/Madrid",
    );
    const runtime = createCalendarSessionRuntime(configured);
    runtime.tools.createEvent.run({
      title: "Lunch",
      timing: {
        kind: "timed",
        date: "2026-08-14",
        time: "13:00",
        durationMinutes: 60,
      },
    });
    const withEvent = {
      ...configured,
      document: runtime.engine.getDocument(),
    };

    const changed = changeCalendarTimeZone(
      withEvent,
      "America/Argentina/Buenos_Aires",
    );

    expect(changed.timeZone).toBe("America/Argentina/Buenos_Aires");
    expect(changed.document).toBe(withEvent.document);
    expect(changed.document.revision).toBe(1);
    expect(changed.document.events[0].title).toBe("Lunch");
  });
});
