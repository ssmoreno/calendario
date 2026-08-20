import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

import { resetFakeCalendar, savedEvents } from "../../agent/lib/fake-calendar";

export default defineEval({
  description:
    "One everyday create reaches the calendar once, through one delegation.",
  async test(t) {
    await resetFakeCalendar();

    await t.send("cumple teo hoy 20hs hasta la 1 en castelar");

    t.succeeded();
    t.noFailedActions();
    t.calledSubagent("calendar", { count: 1 });
    t.check((await savedEvents()).length, equals(1)).label("events saved");
  },
});
