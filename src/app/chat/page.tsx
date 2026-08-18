import type { Metadata } from "next";

import { ChatPage } from "@/components/chat/chat-page";
import { requireSession } from "@/server/session";

export const metadata: Metadata = {
  title: "Eve agent — Calendario",
  description: "A development harness for the Eve calendar agent.",
};

export default async function Chat() {
  const session = await requireSession();
  return <ChatPage userId={session.user.id} />;
}
