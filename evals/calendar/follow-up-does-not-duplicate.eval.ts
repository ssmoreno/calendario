import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

import { resetFakeCalendar, savedEvents } from "../../agent/lib/fake-calendar";

/**
 * The delegation count is the assertion that matters. One saved event proves
 * little on its own now that `create_event` refuses an exact duplicate: a run
 * that re-sent the create brief would still leave one event behind. Eve may
 * send a read-only recheck when it genuinely needs fresh state, but right after
 * acting the report is already in front of it, so a second call here is the
 * regression this guards.
 */
export default defineEval({
  description:
    "Asking whether it happened is answered from the conversation, not by doing it again.",
  async test(t) {
    await resetFakeCalendar();

    await t.send("cumple teo hoy 20hs hasta la 1 en castelar");
    await t.send("lo hiciste?");

    t.succeeded();
    t.noFailedActions();
    t.calledSubagent("calendar", { count: 1 });
    t.check((await savedEvents()).length, equals(1)).label("events saved");
  },
});
