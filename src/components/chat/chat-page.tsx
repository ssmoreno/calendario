"use client";

import { useState, useSyncExternalStore } from "react";

import { Chat } from "./chat";
import { clearSavedChat, readSavedChat, writeSavedChat } from "./chat-storage";

/**
 * `useEveAgent` reads `initialEvents` and `initialSession` once, when it creates
 * its store, so the saved cursor has to exist before the hook first runs. Reading
 * it during render would diverge from the server render, hence the mount gate.
 */
export function ChatPage({ userId }: { userId: string }) {
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  return hydrated ? <HydratedChat userId={userId} /> : null;
}

function HydratedChat({ userId }: { userId: string }) {
  const [saved] = useState(() => readSavedChat(userId));

  return (
    <Chat
      initialEvents={saved.events}
      initialSession={saved.session}
      onForget={() => clearSavedChat(userId)}
      onPersist={(snapshot) => writeSavedChat(userId, snapshot)}
    />
  );
}
