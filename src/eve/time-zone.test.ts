import { describe, expect, it } from "vitest";

import { setTimeZoneSchema } from "./time-zone";

describe("setTimeZoneSchema", () => {
  it("accepts IANA timezones", () => {
    expect(
      setTimeZoneSchema.parse({ timeZone: "America/Argentina/Buenos_Aires" }),
    ).toEqual({ timeZone: "America/Argentina/Buenos_Aires" });
  });

  it("rejects ambiguous location labels", () => {
    expect(() => setTimeZoneSchema.parse({ timeZone: "Buenos Aires" })).toThrow(
      /IANA timezone/,
    );
  });
});
