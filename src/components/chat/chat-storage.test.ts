import { beforeEach, describe, expect, it } from "vitest";

import {
  CHAT_STORAGE_KEY,
  chatStorageKey,
  clearSavedChat,
  readSavedChat,
  writeSavedChat,
} from "./chat-storage";

const savedChat = {
  events: [],
  session: { sessionId: "session-a", streamIndex: 0 },
};

describe("chat storage", () => {
  beforeEach(() => localStorage.clear());

  it("isolates saved sessions by account", () => {
    writeSavedChat("user-a", savedChat);

    expect(readSavedChat("user-a")).toEqual(savedChat);
    expect(readSavedChat("user-b")).toEqual({
      events: [],
      session: undefined,
    });
  });

  it("never exposes an unscoped legacy session to a signed-in account", () => {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(savedChat));

    expect(readSavedChat("user-a")).toEqual({
      events: [],
      session: undefined,
    });
    expect(localStorage.getItem(CHAT_STORAGE_KEY)).not.toBeNull();
  });

  it("clears only the current account session", () => {
    writeSavedChat("user-a", savedChat);
    writeSavedChat("user-b", {
      events: [],
      session: { sessionId: "session-b", streamIndex: 0 },
    });

    clearSavedChat("user-a");

    expect(localStorage.getItem(chatStorageKey("user-a"))).toBeNull();
    expect(readSavedChat("user-b").session?.sessionId).toBe("session-b");
  });
});
