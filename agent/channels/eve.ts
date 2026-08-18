import {
  ForbiddenError,
  localDev,
  vercelOidc,
  type AuthFn,
} from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

import { auth } from "../../src/server/auth";
import { getEveSessionOwner } from "../../src/server/eve-session-owners";

const SESSION_PATH = /\/session\/([^/]+)/;

/**
 * eve decides access at the HTTP boundary and does not enforce session
 * ownership, so a signed-in caller may only touch sessions their own account
 * started. A session with no recorded owner is one that is being created, or
 * one whose id only its creator knows.
 */
async function assertSessionOwnership(request: Request, userId: string) {
  const sessionId = SESSION_PATH.exec(new URL(request.url).pathname)?.[1];
  if (!sessionId) return;
  const owner = await getEveSessionOwner(sessionId);
  if (owner !== null && owner !== userId) {
    throw new ForbiddenError({ message: "That conversation is not yours." });
  }
}

function appSession(): AuthFn<Request> {
  return async (request) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return null;
    await assertSessionOwnership(request, session.user.id);
    return {
      attributes: { email: session.user.email },
      authenticator: "app",
      principalId: session.user.id,
      principalType: "user",
      subject: session.user.id,
    };
  };
}

export default eveChannel({
  auth: [appSession(), vercelOidc(), localDev()],
});
