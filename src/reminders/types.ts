import { z } from "zod";

import {
  CALENDAR_LOCALE,
  isZonedTimestamp,
  zonedTimestampToDate,
} from "@/calendar/date-time";
import { messages } from "@/calendar/messages";

export const reminderBodySchema = z
  .string()
  .trim()
  .min(1, "Say what to remind them about.")
  .max(300, "Keep the reminder to one short sentence.");

export const reminderIdSchema = z.string().trim().min(1);

export const createReminderSchema = z.object({
  body: reminderBodySchema,
  remindAt: z
    .string()
    .refine(isZonedTimestamp, messages.validation.timezoneAwareStart),
});

export const cancelReminderSchema = z.object({
  reminderId: reminderIdSchema,
});

export type CreateReminderInput = z.infer<typeof createReminderSchema>;

export interface ReminderRecord {
  id: string;
  body: string;
  /** The absolute instant, for anything that needs to compare times. */
  remindAt: string;
  /** The same instant written in the zone it was set in, for reading back. */
  localTime: string;
  timeZone: string;
}

export function formatReminderTime(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(CALENDAR_LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(at);
}

/** The instant a zoned timestamp such as `2026-09-12T08:00:00-03:00[…]` names. */
export function reminderInstant(remindAt: string): Date {
  return zonedTimestampToDate(remindAt);
}
