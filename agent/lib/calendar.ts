import type { EveTools } from "../../src/eve/tools";
import { createEveTools } from "../../src/eve/tools";
import { googleCalendarForUser } from "../../src/server/google-calendar";
import { getUserSettings } from "../../src/server/settings-store";
import { requireUserId } from "./auth";

/**
 * The timezone lives in the user's saved settings rather than durable session
 * state because declared subagents start with fresh state: the calendar
 * specialist has to read the same value the root agent wrote.
 */
export async function runCalendar<Result>(
  ctx: Parameters<typeof requireUserId>[0],
  run: (tools: EveTools) => Result | Promise<Result>,
): Promise<Result> {
  const userId = requireUserId(ctx);
  const defaults = await getUserSettings(userId);
  const { timeZone } = defaults;
  if (!timeZone) {
    throw new Error(
      "The calendar timezone is not set. Ask the user for their location or IANA timezone, then call set_time_zone.",
    );
  }
  const service = await googleCalendarForUser(userId, timeZone);
  return await run(createEveTools(service, { timeZone, defaults }));
}
