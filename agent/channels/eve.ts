import {
  ForbiddenError,
  localDev,
  vercelOidc,
  type AuthFn,
} from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

import { auth } from "../../src/server/auth";
import {
  claimEveSession,
  EveSessionOwnershipError,
} from "../../src/server/eve-session-owners";

const SESSION_PATH = /\/session\/([^/]+)/;

/**
 * eve decides access at the HTTP boundary and does not enforce session
 * ownership, so a signed-in caller atomically claims a new session and may
 * only touch it again when the recorded owner matches.
 */
async function assertSessionOwnership(request: Request, userId: string) {
  const sessionId = SESSION_PATH.exec(new URL(request.url).pathname)?.[1];
  if (!sessionId) return;
  try {
    await claimEveSession(sessionId, userId);
  } catch (error) {
    if (!(error instanceof EveSessionOwnershipError)) throw error;
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
