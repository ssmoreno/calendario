import { beforeEach, describe, expect, it } from "vitest";

import {
  AGENT_STORAGE_KEY,
  agentStorageKey,
  clearSavedAgent,
  readSavedAgent,
  writeSavedAgent,
} from "./agent-storage";

const savedAgent = {
  events: [],
  session: { sessionId: "session-a", streamIndex: 0 },
};

describe("agent storage", () => {
  beforeEach(() => localStorage.clear());

  it("preserves the old account-scoped conversation key", () => {
    writeSavedAgent("user-a", savedAgent);
    expect(readSavedAgent("user-a")).toEqual(savedAgent);
    expect(readSavedAgent("user-b").session).toBeUndefined();
    expect(agentStorageKey("user-a")).toContain(AGENT_STORAGE_KEY);
  });

  it("clears only the current account", () => {
    writeSavedAgent("user-a", savedAgent);
    writeSavedAgent("user-b", {
      events: [],
      session: { sessionId: "session-b", streamIndex: 0 },
    });
    clearSavedAgent("user-a");
    expect(readSavedAgent("user-a").session).toBeUndefined();
    expect(readSavedAgent("user-b").session?.sessionId).toBe("session-b");
  });
});
