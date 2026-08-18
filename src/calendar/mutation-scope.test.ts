import { describe, expect, it } from "vitest";

import { rebaseSeriesTiming } from "./mutation-scope";

describe("rebaseSeriesTiming", () => {
  const base = {
    kind: "timed" as const,
    startsAt: "2026-08-17T09:00:00-03:00[America/Argentina/Buenos_Aires]",
    durationMinutes: 60,
  };
  const selected = {
    ...base,
    startsAt: "2026-08-24T09:00:00-03:00[America/Argentina/Buenos_Aires]",
  };

  it("keeps the master's date when only the selected occurrence time changes", () => {
    expect(
      rebaseSeriesTiming(base, selected, {
        ...selected,
        startsAt: "2026-08-24T10:00:00-03:00[America/Argentina/Buenos_Aires]",
      }),
    ).toMatchObject({
      startsAt: "2026-08-17T10:00:00-03:00[America/Argentina/Buenos_Aires]",
    });
  });

  it("keeps an explicit start-date move", () => {
    const moved = {
      ...selected,
      startsAt: "2026-08-25T10:00:00-03:00[America/Argentina/Buenos_Aires]",
    };
    expect(rebaseSeriesTiming(base, selected, moved)).toEqual(moved);
  });
});
