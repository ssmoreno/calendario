import { describe, expect, it } from "vitest";

import {
  DEFAULT_USER_SETTINGS,
  settingsPatchSchema,
  toUserSettings,
} from "./settings";

describe("settingsPatchSchema", () => {
  it("accepts a single recognised setting", () => {
    expect(settingsPatchSchema.parse({ theme: "dark" })).toEqual({
      theme: "dark",
    });
  });

  it("accepts clearing the default reminder", () => {
    expect(
      settingsPatchSchema.parse({ defaultReminderMinutes: null }),
    ).toEqual({ defaultReminderMinutes: null });
  });

  it("rejects an empty patch", () => {
    expect(settingsPatchSchema.safeParse({}).success).toBe(false);
  });

  it("rejects durations outside one day", () => {
    expect(
      settingsPatchSchema.safeParse({ defaultDurationMinutes: 0 }).success,
    ).toBe(false);
    expect(
      settingsPatchSchema.safeParse({ defaultDurationMinutes: 1441 }).success,
    ).toBe(false);
  });

  it("rejects unknown themes and colors", () => {
    expect(settingsPatchSchema.safeParse({ theme: "sepia" }).success).toBe(
      false,
    );
    expect(
      settingsPatchSchema.safeParse({ defaultColor: "blue" }).success,
    ).toBe(false);
  });
});

describe("toUserSettings", () => {
  it("falls back to defaults without a row", () => {
    expect(toUserSettings(null)).toEqual(DEFAULT_USER_SETTINGS);
  });

  it("reads a stored row", () => {
    expect(
      toUserSettings({
        defaultDurationMinutes: 30,
        defaultReminderMinutes: 8,
        defaultColor: "mint",
        theme: "dark",
      }),
    ).toEqual({
      defaultDurationMinutes: 30,
      defaultReminderMinutes: 8,
      defaultColor: "mint",
      theme: "dark",
    });
  });

  it("replaces unreadable values field by field", () => {
    expect(
      toUserSettings({
        defaultDurationMinutes: -5,
        defaultReminderMinutes: 15,
        defaultColor: "chartreuse",
        theme: "sepia",
      }),
    ).toEqual({
      defaultDurationMinutes: 60,
      defaultReminderMinutes: 15,
      defaultColor: "coral",
      theme: "system",
    });
  });
});
