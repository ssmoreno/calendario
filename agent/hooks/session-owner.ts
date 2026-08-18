import { defineHook } from "eve/hooks";

import { claimEveSession } from "../../src/server/eve-session-owners";
import { maybePrincipalId } from "../lib/auth";

/**
 * Records who started each Eve session. The channel's auth walk reads this back
 * on every later request, because eve itself does not enforce session
 * ownership.
 */
export default defineHook({
  events: {
    async "session.started"(_event, ctx) {
      const principalId = maybePrincipalId(ctx);
      if (!principalId) return;
      await claimEveSession(ctx.session.id, principalId);
    },
  },
});
