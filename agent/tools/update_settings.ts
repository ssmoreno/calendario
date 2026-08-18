import { defineTool } from "eve/tools";
import { z } from "zod";

import { reminderMinutes } from "../../src/calendar/reminders";
import {
  MAX_DEFAULT_DURATION_MINUTES,
  THEME_PREFERENCES,
} from "../../src/calendar/settings";
import type { UserSettingsPatch } from "../../src/calendar/settings";
import {
  reminderOffsetSchema,
  savedColor,
  selectableColorSchema,
} from "../../src/eve/tools";
import { updateUserSettings } from "../../src/server/settings-store";
import { requireUserId } from "../lib/auth";

const inputSchema = z
  .object({
    defaultDurationMinutes: z
      .number()
      .int()
      .positive()
      .max(MAX_DEFAULT_DURATION_MINUTES)
      .optional()
      .describe("How long a new event lasts when the user gives no end time."),
    defaultReminder: reminderOffsetSchema
      .nullable()
      .optional()
      .describe(
        "The lead time every new event gets, or null so new events get no reminder.",
      ),
    defaultColor: selectableColorSchema
      .optional()
      .describe(
        "The color of a new event when the user does not name one. Friendly names map as blue=ultramarine, red=coral, green=mint, yellow=gold.",
      ),
    theme: z
      .enum(THEME_PREFERENCES)
      .optional()
      .describe(
        'The app\'s appearance. "system" follows the device setting. This applies right away.',
      ),
  })
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    "Choose at least one setting to change.",
  );

export default defineTool({
  description:
    "Change the user's saved preferences: how long new events last, the reminder they get, their color, and the app theme. Call this when the user asks for a lasting change rather than a change to one event.",
  inputSchema,
  async execute(input, ctx) {
    const patch: UserSettingsPatch = {};
    if (input.defaultDurationMinutes !== undefined) {
      patch.defaultDurationMinutes = input.defaultDurationMinutes;
    }
    if (input.defaultReminder !== undefined) {
      patch.defaultReminderMinutes = input.defaultReminder
        ? reminderMinutes(input.defaultReminder)
        : null;
    }
    if (input.defaultColor !== undefined) {
      patch.defaultColor = savedColor(input.defaultColor);
    }
    if (input.theme !== undefined) patch.theme = input.theme;

    return {
      settings: await updateUserSettings(requireUserId(ctx), patch),
    };
  },
});
