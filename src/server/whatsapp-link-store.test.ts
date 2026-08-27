import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  codeFindUnique: vi.fn(),
  codeDelete: vi.fn(),
  linkCreate: vi.fn(),
  linkDeleteMany: vi.fn(),
  transaction: vi.fn(async (operations: unknown[]) => operations),
}));

vi.mock("./db", () => ({
  prisma: {
    whatsAppLink: {
      create: dbMocks.linkCreate,
      deleteMany: dbMocks.linkDeleteMany,
    },
    whatsAppPairingCode: {
      delete: dbMocks.codeDelete,
      findUnique: dbMocks.codeFindUnique,
    },
    $transaction: dbMocks.transaction,
  },
}));

import { redeemPairingCode } from "./whatsapp-link-store";

const future = new Date(Date.now() + 60_000);
const past = new Date(Date.now() - 1);

describe("redeemPairingCode", () => {
  beforeEach(() => {
    for (const mock of Object.values(dbMocks)) mock.mockClear();
  });

  it("binds the number to the account that minted the code", async () => {
    dbMocks.codeFindUnique.mockResolvedValue({
      code: "123456",
      userId: "user-a",
      expiresAt: future,
    });

    await expect(redeemPairingCode("123456", "15551234567")).resolves.toBe(
      "user-a",
    );
    expect(dbMocks.linkCreate).toHaveBeenCalledWith({
      data: { waId: "15551234567", userId: "user-a" },
    });
    expect(dbMocks.transaction).toHaveBeenCalledOnce();
  });

  it("clears both sides of the one-number-per-account rule first", async () => {
    dbMocks.codeFindUnique.mockResolvedValue({
      code: "123456",
      userId: "user-a",
      expiresAt: future,
    });

    await redeemPairingCode("123456", "15551234567");

    expect(dbMocks.linkDeleteMany).toHaveBeenCalledWith({
      where: { OR: [{ waId: "15551234567" }, { userId: "user-a" }] },
    });
  });

  it("refuses an expired code without touching any link", async () => {
    dbMocks.codeFindUnique.mockResolvedValue({
      code: "123456",
      userId: "user-a",
      expiresAt: past,
    });

    await expect(redeemPairingCode("123456", "15551234567")).resolves.toBeNull();
    expect(dbMocks.transaction).not.toHaveBeenCalled();
  });

  it("refuses a code nobody minted", async () => {
    dbMocks.codeFindUnique.mockResolvedValue(null);

    await expect(redeemPairingCode("000000", "15551234567")).resolves.toBeNull();
    expect(dbMocks.transaction).not.toHaveBeenCalled();
  });
});
