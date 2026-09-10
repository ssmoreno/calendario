import type { SessionAuth } from "eve/context";

/**
 * The slice tools, hooks, and dynamic instruction resolvers all share: each
 * receives its own context shape, but every one carries the session auth.
 */
interface AuthAwareContext {
  readonly session: { readonly auth: SessionAuth };
}

/**
 * The account this turn belongs to, taken only from verified route auth —
 * never from tool input.
 *
 * `localDev()` authenticates a synthetic `local-dev` principal while
 * `eve dev` is running; `prisma/seed.ts` gives it a matching user row so local
 * turns exercise the real account-scoped integrations.
 */
export function maybeUserId(ctx: AuthAwareContext): string | null {
  const caller = ctx.session.auth.current ?? ctx.session.auth.initiator;
  if (!caller) return null;
  if (caller.principalType === "user" || caller.principalType === "local-dev") {
    return caller.principalId;
  }
  return null;
}

/**
 * The WhatsApp thread this turn is answering, when it came from WhatsApp. A
 * reminder dispatched into the same session inherits the initiator, so only
 * the current caller names a thread that is waiting on a reply.
 */
export function maybeThreadId(ctx: AuthAwareContext): string | null {
  const threadId = ctx.session.auth.current?.attributes.threadId;
  return typeof threadId === "string" ? threadId : null;
}

export function maybePrincipalId(ctx: AuthAwareContext): string | null {
  const caller = ctx.session.auth.current ?? ctx.session.auth.initiator;
  return caller?.principalId ?? null;
}

export function requireUserId(ctx: AuthAwareContext): string {
  const userId = maybeUserId(ctx);
  if (!userId) {
    throw new Error("This action needs a signed-in account.");
  }
  return userId;
}
