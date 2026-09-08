import { z } from "zod";

import { isTimeZone } from "@/calendar/date-time";

const timeZoneSchema = z
  .string()
  .trim()
  .refine(isTimeZone, "Use an IANA timezone like Europe/Madrid.");

export const setTimeZoneSchema = z.object({
  timeZone: timeZoneSchema,
});
