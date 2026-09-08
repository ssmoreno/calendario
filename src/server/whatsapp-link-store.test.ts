import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  codeFindUnique: vi.fn(),
  codeDelete: vi.fn(),
  linkCreate: vi.fn(),
  linkDeleteMany: vi.fn(),
  transaction: vi.fn(async (operations: unknown[]) => operations),
}));

vi.mock("./db", () => ({
  prisma: {
    whatsAppLink: { create: db.linkCreate, deleteMany: db.linkDeleteMany },
    whatsAppPairingCode: {
      delete: db.codeDelete,
      findUnique: db.codeFindUnique,
    },
    $transaction: db.transaction,
  },
}));

import { redeemPairingCode } from "./whatsapp-link-store";

describe("redeemPairingCode", () => {
  beforeEach(() => {
    for (const mock of Object.values(db)) mock.mockClear();
  });

  it("moves the phone to the account that minted a valid code", async () => {
    db.codeFindUnique.mockResolvedValue({
      code: "123456",
      userId: "user-a",
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(redeemPairingCode("123456", "15551234567")).resolves.toBe(
      "user-a",
    );
    expect(db.linkDeleteMany).toHaveBeenCalledWith({
      where: { OR: [{ waId: "15551234567" }, { userId: "user-a" }] },
    });
    expect(db.transaction).toHaveBeenCalledOnce();
  });

  it("rejects an expired code without changing a link", async () => {
    db.codeFindUnique.mockResolvedValue({
      code: "123456",
      userId: "user-a",
      expiresAt: new Date(Date.now() - 1),
    });

    await expect(redeemPairingCode("123456", "15551234567")).resolves.toBeNull();
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
