import { z } from "zod";

import { timeZoneSchema } from "@/calendar/settings";

export const setTimeZoneSchema = z.object({
  timeZone: timeZoneSchema,
});
