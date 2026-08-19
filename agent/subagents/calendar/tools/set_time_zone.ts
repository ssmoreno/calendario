import { defineTool } from "eve/tools";

import { currentCalendarTime } from "../../../../src/eve/calendar-context";
import { setTimeZoneSchema } from "../../../../src/eve/time-zone";
import { updateUserSettings } from "../../../../src/server/settings-store";
import { requireUserId } from "../../../lib/auth";

export default defineTool({
  description:
    "Save the user's IANA timezone. Call after the user provides a timezone or a location that you can unambiguously map to one, or when a device timezone is reported and none is saved yet.",
  inputSchema: setTimeZoneSchema,
  async execute({ timeZone }, ctx) {
    await updateUserSettings(requireUserId(ctx), { timeZone });
    return currentCalendarTime(timeZone);
  },
});
