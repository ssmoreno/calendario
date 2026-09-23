import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  chatStateLock: { deleteMany: vi.fn() },
  chatStateCache: { deleteMany: vi.fn() },
  chatStateList: { deleteMany: vi.fn() },
  chatStateQueue: { deleteMany: vi.fn() },
}));

vi.mock("./db", () => ({ prisma: db }));

import { cleanupExpiredChatState } from "./chat-state-store";

describe("cleanupExpiredChatState", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes only state rows whose TTL has elapsed", async () => {
    const now = new Date("2026-09-23T12:00:00.000Z");

    await cleanupExpiredChatState(now);

    for (const table of Object.values(db)) {
      expect(table.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lte: now } },
      });
    }
  });
});
