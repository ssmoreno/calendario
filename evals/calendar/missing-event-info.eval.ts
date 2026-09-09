import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

import { resetFakeCalendar, savedEvents } from "../../agent/lib/fake-calendar";

export default defineEval({
  description:
    "A calendar request without a date or time asks for the missing details instead of guessing.",
  async test(t) {
    await resetFakeCalendar();

    await t.send("agendame un turno médico", {
      clientContext: "Device timezone: America/Argentina/Buenos_Aires",
    });

    t.succeeded();
    t.noFailedActions();
    t.notCalledTool("ask_question");
    t.notCalledTool("create_event");
    t.messageIncludes("?");
    t.check((await savedEvents()).length, equals(0)).label("events saved");
  },
});
