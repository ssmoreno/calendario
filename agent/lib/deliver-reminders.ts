import type { ScheduleToFn } from "eve/schedules";

import {
  claimDueReminders,
  markReminderDelivered,
  releaseReminder,
  type ClaimedReminder,
} from "../../src/server/reminder-store";
import { linkedWaId } from "../../src/server/whatsapp-link-store";
import kapso, { adapter } from "../channels/kapso";

const RETRY_AFTER_MS = 5 * 60_000;

function reminderPrompt(reminder: ClaimedReminder): string {
  return [
    "A reminder the user asked you for is due right now.",
    `Their timezone is ${reminder.timeZone}, so do not ask about it or set it.`,
    "Text them a single short line that reads like a nudge from a person, in the language of the reminder. Do not call any tools, do not greet them, and do not add an offer to help.",
    `Remind them about: ${reminder.body}`,
  ].join("\n\n");
}

async function deliver(
  to: ScheduleToFn,
  reminder: ClaimedReminder,
): Promise<void> {
  const waId = await linkedWaId(reminder.userId);
  if (!waId) {
    // The account unpaired WhatsApp after setting this, so there is nowhere
    // left to send it. Retiring the row beats retrying it every tick forever.
    await markReminderDelivered(reminder.id);
    return;
  }

  try {
    await to(kapso, {
      adapterName: "kapso",
      threadId: await adapter.openDM(waId),
    }).send(reminderPrompt(reminder), {
      auth: {
        attributes: { waId },
        authenticator: "kapso",
        principalId: reminder.userId,
        principalType: "user",
        subject: reminder.userId,
      },
    });
    await markReminderDelivered(reminder.id);
  } catch {
    await releaseReminder(reminder.id, new Date(Date.now() + RETRY_AFTER_MS));
  }
}

/** One pass of the reminder queue, triggered by the authenticated route. */
export async function deliverDueReminders(to: ScheduleToFn): Promise<number> {
  const due = await claimDueReminders();
  await Promise.all(due.map((reminder) => deliver(to, reminder)));
  return due.length;
}
