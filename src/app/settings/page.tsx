import type { Metadata } from "next";

import { messages } from "@/calendar/messages";
import { SettingsPage } from "@/components/settings/settings-page";
import { listMemories } from "@/server/memory-store";
import { requireSession } from "@/server/session";
import { hasGoogleCalendarConnection } from "@/server/google-calendar";
import { getUserSettings } from "@/server/settings-store";
import {
  activePairingCode,
  linkedWaId,
} from "@/server/whatsapp-link-store";

export const metadata: Metadata = {
  title: `${messages.settings.title} — ${messages.appName}`,
};

export default async function Settings() {
  const session = await requireSession();
  const [settings, memories, googleConnected, waId, pairing] =
    await Promise.all([
      getUserSettings(session.user.id),
      listMemories(session.user.id, { limit: null }),
      hasGoogleCalendarConnection(session.user.id),
      linkedWaId(session.user.id),
      activePairingCode(session.user.id),
    ]);

  return (
    <SettingsPage
      email={session.user.email}
      googleConnected={googleConnected}
      userId={session.user.id}
      initialSettings={settings}
      initialMemories={memories}
      initialWhatsApp={{ waId, code: waId ? null : (pairing?.code ?? null) }}
    />
  );
}
