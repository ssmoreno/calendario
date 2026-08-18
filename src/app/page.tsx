import { CalendarApp } from "@/components/calendar/calendar-app";
import { requireSession } from "@/server/session";
import { getUserSettings } from "@/server/settings-store";

export default async function Home() {
  const session = await requireSession();
  return (
    <CalendarApp
      initialSettings={await getUserSettings(session.user.id)}
      userId={session.user.id}
    />
  );
}
