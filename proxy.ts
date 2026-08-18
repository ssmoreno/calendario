import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * An optimistic redirect only: the cookie is not verified here. Every page and
 * route handler behind the gate still resolves the real session server-side.
 */
export default function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const target = new URL("/login", request.url);
  return NextResponse.redirect(target);
}

export const config = {
  // Everything except the login page, the API (which answers 401 itself), the
  // Eve channel (which runs its own auth walk), and static assets.
  matcher: ["/((?!login|api|eve|_next|.*\\..*).*)"],
};
