import { randomUUID } from "node:crypto";

import {
  formatReminderTime,
  reminderInstant,
  type CreateReminderInput,
  type ReminderRecord,
} from "@/reminders/types";

import { prisma } from "./db";

export class ReminderNotFoundError extends Error {
  constructor() {
    super("Reminder not found.");
  }
}

export class ReminderInPastError extends Error {
  constructor() {
    super("That time has already passed.");
  }
}

/** A reminder the dispatcher has leased and is about to deliver. */
export interface ClaimedReminder {
  id: string;
  userId: string;
  body: string;
  timeZone: string;
  remindAt: Date;
  leaseToken: string;
}

interface ReminderRow {
  id: string;
  body: string;
  remindAt: Date;
  timeZone: string;
}

function toRecord(row: ReminderRow): ReminderRecord {
  return {
    id: row.id,
    body: row.body,
    remindAt: row.remindAt.toISOString(),
    localTime: formatReminderTime(row.remindAt, row.timeZone),
    timeZone: row.timeZone,
  };
}

export async function createReminder(
  userId: string,
  input: CreateReminderInput,
  timeZone: string,
  now = new Date(),
): Promise<ReminderRecord> {
  const remindAt = reminderInstant(input.remindAt);
  if (remindAt.getTime() <= now.getTime()) {
    throw new ReminderInPastError();
  }
  const row = await prisma.reminder.create({
    data: { userId, body: input.body, remindAt, timeZone },
    select: { id: true, body: true, remindAt: true, timeZone: true },
  });
  return toRecord(row);
}

/** Everything still owed to the user, soonest first. */
export async function listReminders(
  userId: string,
): Promise<ReminderRecord[]> {
  const rows = await prisma.reminder.findMany({
    where: { userId, deliveredAt: null },
    orderBy: { remindAt: "asc" },
    select: { id: true, body: true, remindAt: true, timeZone: true },
  });
  return rows.map(toRecord);
}

export async function cancelReminder(
  userId: string,
  reminderId: string,
): Promise<ReminderRecord> {
  const row = await prisma.reminder.findFirst({
    where: { id: reminderId, userId, deliveredAt: null },
    select: { id: true, body: true, remindAt: true, timeZone: true },
  });
  if (!row) throw new ReminderNotFoundError();
  await prisma.reminder.delete({ where: { id: row.id } });
  return toRecord(row);
}

/**
 * Take ownership of every reminder that has come due, stamping each with this
 * tick's token. `updateMany` is one statement, so a second dispatcher running
 * concurrently re-reads each row under its write lock, sees a live lease, and
 * skips it. An expired lease falls back in, which is how a crashed send retries.
 */
export async function claimDueReminders(options: {
  now?: Date;
  leaseForMs?: number;
} = {}): Promise<ClaimedReminder[]> {
  const now = options.now ?? new Date();
  const leaseUntil = new Date(now.getTime() + (options.leaseForMs ?? 300_000));
  const leaseToken = randomUUID();

  const { count } = await prisma.reminder.updateMany({
    where: {
      deliveredAt: null,
      remindAt: { lte: now },
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
    },
    data: { leaseUntil, leaseToken },
  });
  if (count === 0) return [];

  const reminders = await prisma.reminder.findMany({
    where: { leaseToken },
    select: {
      id: true,
      userId: true,
      body: true,
      timeZone: true,
      remindAt: true,
    },
  });
  return reminders.map((reminder) => ({ ...reminder, leaseToken }));
}

export async function markReminderDelivered(
  id: string,
  leaseToken: string,
): Promise<void> {
  await prisma.reminder.updateMany({
    where: { id, leaseToken, deliveredAt: null },
    data: { deliveredAt: new Date(), leaseUntil: null, leaseToken: null },
  });
}

/** Hand a failed send back to a later tick. */
export async function releaseReminder(
  id: string,
  leaseToken: string,
  retryAt: Date,
): Promise<void> {
  await prisma.reminder.updateMany({
    where: { id, leaseToken, deliveredAt: null },
    data: { leaseUntil: retryAt, leaseToken: null },
  });
}
