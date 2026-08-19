import { beforeEach, describe, expect, it, vi } from "vitest";

const savedRow = {
  id: "item-1",
  url: "https://example.com/ragu",
  domain: "example.com",
  title: "Ragu" as string | null,
  summary: null as string | null,
  kind: "recipe",
  note: null as string | null,
  createdAt: new Date("2026-08-18T10:00:00.000Z"),
};

const dbMocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("./db", () => ({
  prisma: {
    savedItem: {
      findMany: dbMocks.findMany,
      upsert: dbMocks.upsert,
      deleteMany: dbMocks.deleteMany,
    },
  },
}));

import { SAVED_ITEM_LIST_LIMIT } from "@/library/types";

import { listSavedItems, removeSavedItem, saveItem } from "./saved-item-store";

beforeEach(() => {
  dbMocks.findMany.mockReset().mockResolvedValue([]);
  dbMocks.upsert.mockReset().mockResolvedValue(savedRow);
  dbMocks.deleteMany.mockReset().mockResolvedValue({ count: 1 });
});

describe("saveItem", () => {

  it("derives the domain and keys the upsert on the user's own url", async () => {
    await saveItem("user-a", {
      url: "https://www.example.com/ragu",
      kind: "recipe",
      note: "for sunday",
      title: "Ragu",
      summary: null,
    });

    expect(dbMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_url: { userId: "user-a", url: "https://www.example.com/ragu" } },
        create: expect.objectContaining({ domain: "example.com", userId: "user-a" }),
      }),
    );
  });

  it("keeps an existing title when a re-save could not resolve one", async () => {
    await saveItem("user-a", {
      url: "https://example.com/ragu",
      kind: "recipe",
      note: null,
      title: null,
      summary: null,
    });

    expect(dbMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { kind: "recipe" } }),
    );
  });

  it("reads an unknown stored kind as a plain link", async () => {
    dbMocks.upsert.mockResolvedValueOnce({ ...savedRow, kind: "podcast" });

    const saved = await saveItem("user-a", {
      url: "https://example.com/x",
      kind: "link",
      note: null,
      title: null,
      summary: null,
    });

    expect(saved.kind).toBe("link");
  });
});

describe("listSavedItems", () => {
  it("caps agent-facing reads by default", async () => {
    await listSavedItems("user-a");

    expect(dbMocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: SAVED_ITEM_LIST_LIMIT }),
    );
  });

  it("searches title, summary, note, and domain together", async () => {
    await listSavedItems("user-a", { query: "pasta", kind: "recipe" });

    const { where } = dbMocks.findMany.mock.calls[0][0];
    expect(where.kind).toBe("recipe");
    expect(where.OR.map((clause: Record<string, unknown>) => Object.keys(clause)[0])).toEqual([
      "title",
      "summary",
      "note",
      "domain",
    ]);
  });

  it("omits the search filter when the query is blank", async () => {
    await listSavedItems("user-a", { query: "   " });

    expect(dbMocks.findMany.mock.calls[0][0].where).toEqual({ userId: "user-a" });
  });
});

describe("removeSavedItem", () => {
  it("scopes the delete to the owner", async () => {
    await expect(removeSavedItem("user-a", "item-1")).resolves.toBe(true);

    expect(dbMocks.deleteMany).toHaveBeenCalledWith({
      where: { id: "item-1", userId: "user-a" },
    });
  });
});
