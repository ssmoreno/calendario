import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

import { resetFakeCalendar, savedEvents } from "../../agent/lib/fake-calendar";

export default defineEval({
  description:
    "An English calendar request receives a brief English confirmation.",
  async test(t) {
    await resetFakeCalendar();

    await t.send("Schedule coffee tomorrow at 3 PM", {
      clientContext: "Device timezone: America/Argentina/Buenos_Aires",
    });

    t.succeeded();
    t.noFailedActions();
    t.calledTool("create_event", { count: 1 });
    t.check(t.reply, equals("Scheduled.")).label("English confirmation");
    t.check((await savedEvents()).length, equals(1)).label("events saved");
  },
});
