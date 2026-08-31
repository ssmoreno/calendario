import type { ClientSessionState, MessageStreamEvent } from "eve/client";

import { scopedStorageKey, type KeyValueStorage } from "@/lib/scoped-storage";

export const AGENT_STORAGE_KEY = "calendario.chat.v1";

export interface AgentSnapshot {
  events: readonly MessageStreamEvent[];
  session: ClientSessionState | undefined;
}

const emptyAgent: AgentSnapshot = { events: [], session: undefined };

export function agentStorageKey(userId: string): string {
  return scopedStorageKey(AGENT_STORAGE_KEY, userId);
}

export function readSavedAgent(
  userId: string,
  storage: KeyValueStorage = localStorage,
): AgentSnapshot {
  try {
    const raw = storage.getItem(agentStorageKey(userId));
    if (!raw) return emptyAgent;
    const saved = JSON.parse(raw) as Partial<AgentSnapshot>;
    if (
      !Array.isArray(saved.events) ||
      typeof saved.session?.sessionId !== "string"
    ) {
      return emptyAgent;
    }
    return { events: saved.events, session: saved.session };
  } catch {
    return emptyAgent;
  }
}

/** Whether reopening the Agent should land on a conversation already going. */
export function hasSavedAgent(
  userId: string,
  storage: KeyValueStorage = localStorage,
): boolean {
  return readSavedAgent(userId, storage).events.length > 0;
}

export function writeSavedAgent(
  userId: string,
  snapshot: AgentSnapshot,
  storage: KeyValueStorage = localStorage,
): void {
  try {
    storage.setItem(agentStorageKey(userId), JSON.stringify(snapshot));
  } catch {
    // A private or full browser store only prevents conversation resumption.
  }
}

export function clearSavedAgent(
  userId: string,
  storage: KeyValueStorage = localStorage,
): void {
  try {
    storage.removeItem(agentStorageKey(userId));
  } catch {
    // An unavailable browser store already has no usable cursor.
  }
}
