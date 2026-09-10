import { prisma } from "../../src/server/db";
import { LIBRARY_EVAL_USER_ID } from "../library/helpers";

export const REMINDER_EVAL_USER_ID = LIBRARY_EVAL_USER_ID;
export const REMINDER_EVAL_ZONE = "America/Argentina/Buenos_Aires";

const EVAL_WA_ID = "5491100000000";

/**
 * `create_reminder` refuses an account it could never text, so the eval user
 * needs a paired number the same way a real one does.
 */
export async function ensureReminderEvalWhatsApp() {
  await prisma.whatsAppLink.deleteMany({
    where: { OR: [{ waId: EVAL_WA_ID }, { userId: REMINDER_EVAL_USER_ID }] },
  });
  await prisma.whatsAppLink.create({
    data: { waId: EVAL_WA_ID, userId: REMINDER_EVAL_USER_ID },
  });
}

export async function clearReminderEvalWhatsApp() {
  await prisma.whatsAppLink.deleteMany({
    where: { userId: REMINDER_EVAL_USER_ID },
  });
}

export async function clearReminders() {
  await prisma.reminder.deleteMany({
    where: { userId: REMINDER_EVAL_USER_ID },
  });
}

export async function onlyReminder() {
  const rows = await prisma.reminder.findMany({
    where: { userId: REMINDER_EVAL_USER_ID },
  });
  return rows.length === 1 ? rows[0]! : null;
}

/** The wall-clock hour and weekday a stored instant lands on for the user. */
export function localParts(at: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: REMINDER_EVAL_ZONE,
  }).formatToParts(at);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return { weekday: value("weekday"), hour: Number(value("hour")) };
}
