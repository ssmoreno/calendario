import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/session", () => ({ getSession: vi.fn() }));

vi.mock("@/server/db", () => ({
  prisma: { savedItem: { findMany: vi.fn() } },
}));

import { prisma } from "@/server/db";
import { getSession } from "@/server/session";

import { GET } from "./route";

const ROW = {
  id: "item-1",
  url: "https://seriouseats.com/cacio-e-pepe",
  domain: "seriouseats.com",
  title: "Cacio e Pepe",
  summary: null,
  kind: "recipe",
  note: "sunday dinner",
  createdAt: new Date("2026-09-01T10:00:00Z"),
};

const RECORD = {
  id: ROW.id,
  url: ROW.url,
  domain: ROW.domain,
  title: ROW.title,
  summary: ROW.summary,
  kind: ROW.kind,
  note: ROW.note,
  createdAt: ROW.createdAt.toISOString(),
};

describe("GET /api/library", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "user-1" },
    } as Awaited<ReturnType<typeof getSession>>);
    vi.mocked(prisma.savedItem.findMany).mockResolvedValue([
      { ...ROW, userId: "user-1", updatedAt: ROW.createdAt },
    ]);
  });

  it("refuses a signed-out request", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    expect((await GET()).status).toBe(401);
  });

  it("returns every saved item rather than the agent's page of them", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ items: [RECORD] });
    expect(vi.mocked(prisma.savedItem.findMany).mock.calls[0][0]).toMatchObject({
      where: { userId: "user-1" },
      take: undefined,
    });
  });
});
