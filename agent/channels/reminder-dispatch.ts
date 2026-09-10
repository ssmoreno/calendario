import { defineChannel, POST } from "eve/channels";

import { isDispatchAuthorized } from "../../src/reminders/dispatch-auth";
import { deliverDueReminders } from "../lib/deliver-reminders";

/**
 * Supabase Cron calls this route once a minute. It can only flush reminders
 * that are already due and already belong to a paired account, but it does
 * cause outbound WhatsApp messages, so it stays shut unless a secret is set.
 */
export default defineChannel({
  routes: [
    POST("/eve/v1/reminders/dispatch", async (request, { to, waitUntil }) => {
      if (
        !isDispatchAuthorized(
          request.headers.get("authorization"),
          process.env.REMINDER_DISPATCH_SECRET,
        )
      ) {
        return new Response("Not found", { status: 404 });
      }
      // Answer Supabase immediately; the sends outlive the response.
      waitUntil(deliverDueReminders(to));
      return Response.json({ dispatched: true });
    }),
  ],
});
