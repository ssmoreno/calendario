import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

import { resetFakeCalendar, savedEvents } from "../../agent/lib/fake-calendar";

export default defineEval({
  description:
    "Asking whether it happened is answered from the conversation, not by doing it again.",
  async test(t) {
    await resetFakeCalendar();

    const context = {
      clientContext: "Device timezone: America/Argentina/Buenos_Aires",
    };
    await t.send("cumple teo hoy 20hs hasta la 1 en castelar", context);
    await t.send("lo hiciste?", context);

    t.succeeded();
    t.noFailedActions();
    t.calledTool("create_event", { count: 1 });
    t.check((await savedEvents()).length, equals(1)).label("events saved");
  },
});
