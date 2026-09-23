import { defineHook } from "eve/hooks";

import { claimEveSession } from "../../src/server/eve-session-owners";
import { maybePrincipalId } from "../lib/auth";

/**
 * Records the principal for sessions started through non-app auth paths too.
 * The app channel independently claims a session at the HTTP boundary.
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
