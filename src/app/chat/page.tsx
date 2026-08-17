import type { Metadata } from "next";

import { ChatPage } from "@/components/chat/chat-page";

export const metadata: Metadata = {
  title: "Eve agent — Calendario",
  description: "A development harness for the Eve calendar agent.",
};

export default function Chat() {
  return <ChatPage />;
}
