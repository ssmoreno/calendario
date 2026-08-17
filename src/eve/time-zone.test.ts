import { describe, expect, it } from "vitest";

import { timeZoneSchema } from "./time-zone";

describe("timeZoneSchema", () => {
  it("accepts IANA timezones", () => {
    expect(
      timeZoneSchema.parse({ timeZone: "America/Argentina/Buenos_Aires" }),
    ).toEqual({ timeZone: "America/Argentina/Buenos_Aires" });
  });

  it("rejects ambiguous location labels", () => {
    expect(() => timeZoneSchema.parse({ timeZone: "Buenos Aires" })).toThrow(
      /IANA timezone/,
    );
  });
});
