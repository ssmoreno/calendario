import type { EveTools } from "../../src/eve/tools";
import { createEveTools } from "../../src/eve/tools";
import { googleCalendarForUser } from "../../src/server/google-calendar";
import { prisma } from "../../src/server/db";
import { getUserSettings } from "../../src/server/settings-store";
import { requireUserId } from "./auth";
import { fakeCalendar, fakeCalendarPath } from "./fake-calendar";

function serializeCreateForUser<Result>(
  userId: string,
  create: () => Promise<Result>,
): Promise<Result> {
  return prisma.$transaction(
    async (transaction) => {
      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtext('calendario-calendar-create'),
          hashtext(${userId})
        )
      `;
      return await create();
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
}

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
  const storePath = fakeCalendarPath();
  const service = storePath
    ? fakeCalendar(storePath, timeZone)
    : await googleCalendarForUser(userId, timeZone);
  return await run(
    createEveTools(service, {
      timeZone,
      defaults,
      serializeCreate: (create) => serializeCreateForUser(userId, create),
    }),
  );
}
