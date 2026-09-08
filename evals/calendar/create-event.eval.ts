import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

import { resetFakeCalendar, savedEvents } from "../../agent/lib/fake-calendar";

export default defineEval({
  description:
    "One everyday request creates one calendar event.",
  async test(t) {
    await resetFakeCalendar();

    await t.send("cumple teo hoy 20hs hasta la 1 en castelar", {
      clientContext: "Device timezone: America/Argentina/Buenos_Aires",
    });

    t.succeeded();
    t.noFailedActions();
    t.calledTool("create_event", { count: 1 });
    t.check((await savedEvents()).length, equals(1)).label("events saved");
  },
});
