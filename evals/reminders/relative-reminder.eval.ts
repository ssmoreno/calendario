import { defineEval } from "eve/evals";
import { equals, satisfies } from "eve/evals/expect";

import { resetFakeCalendar, savedEvents } from "../../agent/lib/fake-calendar";
import { ensureLibraryEvalUser } from "../library/helpers";
import {
  clearReminderEvalWhatsApp,
  clearReminders,
  ensureReminderEvalWhatsApp,
  onlyReminder,
  REMINDER_EVAL_ZONE,
} from "./helpers";

export default defineEval({
  description:
    "An errand with a duration schedules one reminder and no calendar event.",
  async test(t) {
    await ensureLibraryEvalUser();
    await resetFakeCalendar();
    await clearReminders();
    await ensureReminderEvalWhatsApp();

    try {
      const sentAt = Date.now();
      await t.send("sacar las milanesas del horno en 30min", {
        clientContext: `Device timezone: ${REMINDER_EVAL_ZONE}`,
      });

      t.succeeded();
      t.noFailedActions();
      t.calledTool("create_reminder", { count: 1 });

      const reminder = await onlyReminder();
      t.check(reminder !== null, equals(true)).label("one reminder stored");
      if (reminder) {
        const minutesOut =
          (reminder.remindAt.getTime() - sentAt) / 60_000;
        t.check(
          minutesOut,
          satisfies(
            (value: number) => value > 25 && value < 35,
            "fires about thirty minutes out",
          ),
        ).label("timing");
        t.check(reminder.timeZone, equals(REMINDER_EVAL_ZONE)).label("zone");
      }

      t.check((await savedEvents()).length, equals(0)).label(
        "no calendar event",
      );
    } finally {
      await clearReminders();
      await clearReminderEvalWhatsApp();
    }
  },
});
