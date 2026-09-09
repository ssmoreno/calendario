import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import { resetFakeCalendar, savedEvents } from "../../agent/lib/fake-calendar";

export default defineEval({
  description:
    "An incomplete English request gets one short English question without filler.",
  async test(t) {
    await resetFakeCalendar();

    await t.send("Schedule a dentist appointment", {
      clientContext: "Device timezone: America/Argentina/Buenos_Aires",
    });

    t.succeeded();
    t.noFailedActions();
    t.notCalledTool("ask_question");
    t.notCalledTool("create_event");
    t.check(
      t.reply,
      satisfies(
        (reply) =>
          typeof reply === "string" &&
          reply.length <= 100 &&
          reply.endsWith("?") &&
          /when|date|day|time/i.test(reply),
        "one short English scheduling question",
      ),
    );
    t.check(
      t.reply,
      satisfies(
        (reply) =>
          typeof reply === "string" &&
          !/of course|certainly|happy to|let me know/i.test(reply),
        "no canned filler",
      ),
    );
    t.check(
      (await savedEvents()).length,
      satisfies((count) => count === 0, "no event saved"),
    );
  },
});
