import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

import { resetFakeCalendar } from "../../agent/lib/fake-calendar";
import { ensureLibraryEvalUser } from "../library/helpers";
import {
  clearReminderEvalWhatsApp,
  clearReminders,
  ensureReminderEvalWhatsApp,
  localParts,
  onlyReminder,
  REMINDER_EVAL_ZONE,
} from "./helpers";

export default defineEval({
  description:
    "A loosely worded day and time resolves to a concrete reminder without a follow-up question.",
  async test(t) {
    await ensureLibraryEvalUser();
    await resetFakeCalendar();
    await clearReminders();
    await ensureReminderEvalWhatsApp();

    try {
      await t.send(
        "haceme acordar de escribirle a mi mama el sabado temprano",
        { clientContext: `Device timezone: ${REMINDER_EVAL_ZONE}` },
      );

      t.succeeded();
      t.noFailedActions();
      t.calledTool("create_reminder", { count: 1 });

      const reminder = await onlyReminder();
      t.check(reminder !== null, equals(true)).label("one reminder stored");
      if (reminder) {
        const { weekday, hour } = localParts(reminder.remindAt);
        t.check(weekday, equals("Saturday")).label("lands on Saturday");
        t.check(hour, equals(8)).label("uses the early default");
      }
    } finally {
      await clearReminders();
      await clearReminderEvalWhatsApp();
    }
  },
});
