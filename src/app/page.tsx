import { Dashboard } from "@/components/dashboard/dashboard";
import { hasGoogleCalendarConnection } from "@/server/google-calendar";
import { requireSession } from "@/server/session";

export default async function Home() {
  const session = await requireSession();
  return (
    <Dashboard
      initialConnected={await hasGoogleCalendarConnection(session.user.id)}
      user={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      }}
    />
  );
}
