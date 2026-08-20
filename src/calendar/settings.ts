import { z } from "zod";

import { isTimeZone } from "./date-time";
import { MAX_REMINDER_MINUTES } from "./reminders";
import { EVENT_COLORS, type EventColor, type ThemePreference } from "./types";

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export const MAX_DEFAULT_DURATION_MINUTES = 1_440;

export interface UserSettings {
  defaultDurationMinutes: number;
  /** null means new events start without a reminder. */
  defaultReminderMinutes: number | null;
  defaultColor: EventColor;
  theme: ThemePreference;
  /** null until the agent has resolved the user's IANA timezone. */
  timeZone: string | null;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  defaultDurationMinutes: 60,
  defaultReminderMinutes: null,
  defaultColor: "coral",
  theme: "dark",
  timeZone: null,
};

export const defaultDurationMinutesSchema = z
  .number()
  .int()
  .positive()
  .max(MAX_DEFAULT_DURATION_MINUTES);

export const defaultReminderMinutesSchema = z
  .number()
  .int()
  .nonnegative()
  .max(MAX_REMINDER_MINUTES)
  .nullable();

export const themePreferenceSchema = z.enum(THEME_PREFERENCES);

export const timeZoneSchema = z
  .string()
  .trim()
  .refine(isTimeZone, "Use an IANA timezone like Europe/Madrid.");

export const settingsPatchSchema = z
  .object({
    defaultDurationMinutes: defaultDurationMinutesSchema.optional(),
    defaultReminderMinutes: defaultReminderMinutesSchema.optional(),
    defaultColor: z.enum(EVENT_COLORS).optional(),
    theme: themePreferenceSchema.optional(),
    timeZone: timeZoneSchema.optional(),
  })
  .refine(
    (patch) => Object.values(patch).some((value) => value !== undefined),
    "Include at least one setting to change.",
  );

export type UserSettingsPatch = z.infer<typeof settingsPatchSchema>;

export interface StoredUserSettings {
  defaultDurationMinutes: number;
  defaultReminderMinutes: number | null;
  defaultColor: string;
  theme: string;
  timeZone: string | null;
}

/**
 * Rows can outlive the values the app still accepts, so anything unreadable
 * falls back to the default rather than breaking a page or a turn.
 */
export function toUserSettings(row: StoredUserSettings | null): UserSettings {
  if (!row) return DEFAULT_USER_SETTINGS;
  const duration = defaultDurationMinutesSchema.safeParse(
    row.defaultDurationMinutes,
  );
  const reminder = defaultReminderMinutesSchema.safeParse(
    row.defaultReminderMinutes,
  );
  const color = z.enum(EVENT_COLORS).safeParse(row.defaultColor);
  const theme = themePreferenceSchema.safeParse(row.theme);
  const timeZone = timeZoneSchema.safeParse(row.timeZone);
  return {
    defaultDurationMinutes: duration.success
      ? duration.data
      : DEFAULT_USER_SETTINGS.defaultDurationMinutes,
    defaultReminderMinutes: reminder.success
      ? reminder.data
      : DEFAULT_USER_SETTINGS.defaultReminderMinutes,
    defaultColor: color.success
      ? color.data
      : DEFAULT_USER_SETTINGS.defaultColor,
    theme: theme.success ? theme.data : DEFAULT_USER_SETTINGS.theme,
    timeZone: timeZone.success ? timeZone.data : DEFAULT_USER_SETTINGS.timeZone,
  };
}

export interface UserMemoryRecord {
  id: string;
  content: string;
  createdAt: string;
}

export const MAX_MEMORY_LENGTH = 2_000;
export const MEMORY_LIST_LIMIT = 50;

export const memoryContentSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_MEMORY_LENGTH);
