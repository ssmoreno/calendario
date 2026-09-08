import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { hasGoogleCalendarConnection } from "@/server/google-calendar";
import { requireSession } from "@/server/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  return (
    <AppShell
      initialConnected={await hasGoogleCalendarConnection(session.user.id)}
      user={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      }}
    >
      {children}
    </AppShell>
  );
}
