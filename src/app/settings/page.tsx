import type { Metadata } from "next";

import { messages } from "@/calendar/messages";
import { SettingsPage } from "@/components/settings/settings-page";
import { listMemories } from "@/server/memory-store";
import { requireSession } from "@/server/session";
import { getUserSettings } from "@/server/settings-store";

export const metadata: Metadata = {
  title: `${messages.settings.title} — ${messages.appName}`,
};

export default async function Settings() {
  const session = await requireSession();
  const [settings, memories] = await Promise.all([
    getUserSettings(session.user.id),
    listMemories(session.user.id, { limit: null }),
  ]);

  return (
    <SettingsPage
      email={session.user.email}
      userId={session.user.id}
      initialSettings={settings}
      initialMemories={memories}
    />
  );
}
