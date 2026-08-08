export const MAX_REMINDER_MINUTES = 525_600;
export const REMINDER_UNITS = ["minutes", "hours", "days", "weeks"] as const;

export type ReminderUnit = (typeof REMINDER_UNITS)[number];

export interface ReminderOffset {
  amount: number;
  unit: ReminderUnit;
}

export const REMINDER_MINUTES_PER_UNIT: Record<ReminderUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1_440,
  weeks: 10_080,
};

export function reminderMinutes({ amount, unit }: ReminderOffset): number {
  return amount * REMINDER_MINUTES_PER_UNIT[unit];
}
