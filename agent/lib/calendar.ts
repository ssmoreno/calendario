import { Client } from "pg";

import type { EveTools } from "../../src/eve/tools";
import { createEveTools } from "../../src/eve/tools";
import { googleCalendarForUser } from "../../src/server/google-calendar";
import { requireUserId } from "./auth";
import { calendarTimeZone } from "./calendar-time-zone";
import { fakeCalendar, fakeCalendarPath } from "./fake-calendar";

async function serializeCreateForUser<Result>(
  userId: string,
  create: () => Promise<Result>,
): Promise<Result> {
  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) {
    throw new Error(
      "DIRECT_URL is required to protect calendar creates from duplicates.",
    );
  }

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

export async function runCalendar<Result>(
  ctx: Parameters<typeof requireUserId>[0],
  run: (tools: EveTools) => Result | Promise<Result>,
): Promise<Result> {
  const userId = requireUserId(ctx);
  const timeZone = calendarTimeZone.get();
  if (!timeZone) {
    throw new Error(
      "The calendar timezone is not set. Call set_time_zone with the device timezone from the client context before using calendar tools.",
    );
  }
  const storePath = fakeCalendarPath();
  const service = storePath
    ? fakeCalendar(storePath, timeZone)
    : await googleCalendarForUser(userId, timeZone);
  return await run(
    createEveTools(service, {
      timeZone,
      serializeCreate: (create) => serializeCreateForUser(userId, create),
    }),
  );
}
