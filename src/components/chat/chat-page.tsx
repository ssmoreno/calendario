"use client";

import { useState, useSyncExternalStore } from "react";
import type { ClientSessionState, MessageStreamEvent } from "eve/client";

import { Chat, type ChatSnapshot } from "./chat";

const STORAGE_KEY = "calendario.chat.v1";

interface SavedChat {
  events: readonly MessageStreamEvent[];
  session: ClientSessionState | undefined;
}

const emptyChat: SavedChat = { events: [], session: undefined };

function readSavedChat(): SavedChat {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyChat;
    const saved = JSON.parse(raw) as Partial<SavedChat>;
    const sessionId = saved.session?.sessionId;
    if (!Array.isArray(saved.events) || typeof sessionId !== "string") {
      return emptyChat;
    }
    return { events: saved.events, session: saved.session };
  } catch {
    return emptyChat;
  }
}

function writeSavedChat(snapshot: ChatSnapshot) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // A full or unavailable store only costs this harness its resume cursor.
  }
}

/**
 * `useEveAgent` reads `initialEvents` and `initialSession` once, when it creates
 * its store, so the saved cursor has to exist before the hook first runs. Reading
 * it during render would diverge from the server render, hence the mount gate.
 */
export function ChatPage() {
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  return hydrated ? <HydratedChat /> : null;
}

function HydratedChat() {
  const [saved] = useState(readSavedChat);

  return (
    <Chat
      initialEvents={saved.events}
      initialSession={saved.session}
      onForget={() => localStorage.removeItem(STORAGE_KEY)}
      onPersist={writeSavedChat}
    />
  );
}
