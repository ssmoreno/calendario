import type { ClientSessionState, MessageStreamEvent } from "eve/client";

import { scopedStorageKey, type KeyValueStorage } from "@/lib/scoped-storage";

import type { ChatSnapshot } from "./chat";

export const CHAT_STORAGE_KEY = "calendario.chat.v1";

export interface SavedChat {
  events: readonly MessageStreamEvent[];
  session: ClientSessionState | undefined;
}

const emptyChat: SavedChat = { events: [], session: undefined };

export function chatStorageKey(userId: string): string {
  return scopedStorageKey(CHAT_STORAGE_KEY, userId);
}

export function readSavedChat(
  userId: string,
  storage: KeyValueStorage = localStorage,
): SavedChat {
  const storageKey = chatStorageKey(userId);
  try {
    const raw = storage.getItem(storageKey);
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

export function writeSavedChat(
  userId: string,
  snapshot: ChatSnapshot,
  storage: KeyValueStorage = localStorage,
): void {
  try {
    storage.setItem(chatStorageKey(userId), JSON.stringify(snapshot));
  } catch {
    // A full or unavailable store only costs this harness its resume cursor.
  }
}

export function clearSavedChat(
  userId: string,
  storage: KeyValueStorage = localStorage,
): void {
  try {
    storage.removeItem(chatStorageKey(userId));
  } catch {
    // An unavailable store already has no cursor to clear.
  }
}
