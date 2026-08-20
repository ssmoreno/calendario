import { Client } from "pg";

import type { EveTools } from "../../src/eve/tools";
import { createEveTools } from "../../src/eve/tools";
import { googleCalendarForUser } from "../../src/server/google-calendar";
import { getUserSettings } from "../../src/server/settings-store";
import { requireUserId } from "./auth";
import { fakeCalendar, fakeCalendarPath } from "./fake-calendar";

async function serializeCreateForUser<Result>(
  userId: string,
  create: () => Promise<Result>,
): Promise<Result> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(
      "SELECT pg_advisory_lock(hashtext($1), hashtext($2))",
      ["calendario-calendar-create", userId],
    );
    return await create();
  } finally {
    await client.end();
  }
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
