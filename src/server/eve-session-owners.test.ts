import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  upsert: vi.fn(),
}));

vi.mock("./db", () => ({
  prisma: {
    eveSessionOwner: {
      upsert: dbMocks.upsert,
    },
  },
}));

import {
  claimEveSession,
  EveSessionOwnershipError,
} from "./eve-session-owners";

describe("claimEveSession", () => {
  beforeEach(() => dbMocks.upsert.mockReset());

  it("accepts a new or repeated claim by the same owner", async () => {
    dbMocks.upsert.mockResolvedValue({ userId: "user-a" });

    await expect(claimEveSession("session-a", "user-a")).resolves.toBeUndefined();
  });

  it("rejects a conflicting owner without overwriting the existing row", async () => {
    dbMocks.upsert.mockResolvedValue({ userId: "user-a" });

    await expect(
      claimEveSession("session-a", "user-b"),
    ).rejects.toBeInstanceOf(EveSessionOwnershipError);
    expect(dbMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    );
  });
});
