import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  findMany: vi.fn(async () => []),
}));

vi.mock("./db", () => ({
  prisma: {
    userMemory: {
      findMany: dbMocks.findMany,
    },
  },
}));

import { MEMORY_LIST_LIMIT } from "@/calendar/settings";

import { listMemories } from "./memory-store";

describe("listMemories", () => {
  beforeEach(() => dbMocks.findMany.mockClear());

  it("caps agent-facing reads by default", async () => {
    await listMemories("user-a");

    expect(dbMocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: MEMORY_LIST_LIMIT }),
    );
  });

  it("allows management views to retrieve every memory", async () => {
    await listMemories("user-a", { limit: null });

    expect(dbMocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: undefined }),
    );
  });
});
