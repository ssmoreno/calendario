import { timingSafeEqual } from "node:crypto";

/**
 * Guards the reminder dispatch route. Without a configured secret the route
 * stays shut rather than open, so an unconfigured deployment cannot be driven
 * by a stranger.
 */
export function isDispatchAuthorized(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return false;

  const offered = authorization?.replace(/^Bearer /, "");
  if (!offered) return false;

  const a = Buffer.from(offered);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
