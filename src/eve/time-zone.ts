import { z } from "zod";

import { isTimeZone } from "@/calendar/date-time";

export const timeZoneSchema = z.object({
  timeZone: z
    .string()
    .trim()
    .refine(isTimeZone, "Use an IANA timezone like Europe/Madrid."),
});
