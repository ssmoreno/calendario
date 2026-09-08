import type { EventColor } from "./types";

export interface CalendarDefaults {
  defaultDurationMinutes: number;
  defaultReminderMinutes: number | null;
  defaultColor: EventColor;
}

export const DEFAULT_CALENDAR_DEFAULTS: CalendarDefaults = {
  defaultDurationMinutes: 60,
  defaultReminderMinutes: null,
  defaultColor: "coral",
};
