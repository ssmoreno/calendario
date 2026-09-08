import { isTimeZone } from "@/calendar/date-time";
import { auth } from "@/server/auth";
import {
  googleCalendarForUser,
  GoogleCalendarError,
  hasGoogleCalendarConnection,
} from "@/server/google-calendar";

const NO_STORE = { "cache-control": "private, no-store" };

/* The future rail looks two weeks ahead without turning into a month view. */
const UPCOMING_DAYS = 15;

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json(
      { error: "Authentication required." },
      { status: 401, headers: NO_STORE },
    );
  }

  if (!(await hasGoogleCalendarConnection(session.user.id))) {
    return Response.json(
      { status: "not_connected", events: [] },
      { headers: NO_STORE },
    );
  }

  const requestedTimeZone = new URL(request.url).searchParams.get("timeZone");
  const timeZone =
    requestedTimeZone && isTimeZone(requestedTimeZone)
      ? requestedTimeZone
      : "UTC";
  try {
    const calendar = await googleCalendarForUser(session.user.id, timeZone);
    const events = await calendar.listUpcoming({ days: UPCOMING_DAYS });
    return Response.json({ status: "connected", events }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof GoogleCalendarError) {
      if (error.kind === "authorization") {
        return Response.json(
          { status: "not_connected", reason: "authorization", events: [] },
          { headers: NO_STORE },
        );
      }
      if (error.kind === "not_connected") {
        return Response.json(
          { status: "not_connected", events: [] },
          { headers: NO_STORE },
        );
      }
      return Response.json(
        { error: error.message },
        { status: 503, headers: NO_STORE },
      );
    }
    throw error;
  }
}
