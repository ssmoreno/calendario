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
 * turns exercise the real settings and memory stores.
 */
export function maybeUserId(ctx: AuthAwareContext): string | null {
  const caller = ctx.session.auth.current ?? ctx.session.auth.initiator;
  if (!caller) return null;
  if (caller.principalType === "user" || caller.principalType === "local-dev") {
    return caller.principalId;
  }
  return null;
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
