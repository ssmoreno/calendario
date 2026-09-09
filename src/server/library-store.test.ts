import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LibraryItemInput } from "@/library/types";

const createdAt = new Date("2026-09-08T12:00:00.000Z");
const item = {
  id: "item-1",
  userId: "user-a",
  title: "Prisma guide",
  description: "Database reference",
  link: "https://example.com/prisma",
  tags: ["Documentation", "Coding"],
  createdAt,
  updatedAt: createdAt,
};

const db = vi.hoisted(() => ({
  libraryItem: {
    count: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("./db", () => ({ prisma: db }));

import { listLibrary, saveLibraryItem } from "./library-store";

beforeEach(() => {
  db.libraryItem.count.mockReset().mockResolvedValue(1);
  db.libraryItem.create.mockReset().mockResolvedValue(item);
  db.libraryItem.findMany
    .mockReset()
    .mockResolvedValueOnce([item])
    .mockResolvedValueOnce([{ tags: item.tags }]);
  db.libraryItem.findUnique.mockReset().mockResolvedValue(null);
});

describe("listLibrary", () => {
  it("returns flat items, available tags, and serialized dates", async () => {
    await expect(listLibrary("user-a")).resolves.toEqual({
      items: [
        {
          id: "item-1",
          title: "Prisma guide",
          description: "Database reference",
          link: "https://example.com/prisma",
          tags: ["Documentation", "Coding"],
          createdAt: createdAt.toISOString(),
        },
      ],
      availableTags: ["Coding", "Documentation"],
      totalCount: 1,
    });
    expect(db.libraryItem.findMany).toHaveBeenNthCalledWith(1, {
      where: { userId: "user-a" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("requires every query term and selected tag", async () => {
    await listLibrary("user-a", {
      query: "database guide",
      tags: ["Coding", "Documentation"],
    });

    expect(db.libraryItem.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-a",
          tags: { hasEvery: ["Coding", "Documentation"] },
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { title: { contains: "database", mode: "insensitive" } },
              ]),
            }),
            expect.objectContaining({
              OR: expect.arrayContaining([
                { description: { contains: "guide", mode: "insensitive" } },
              ]),
            }),
          ]),
        }),
      }),
    );
  });

  it("matches allowlisted tag names regardless of typed capitalization", async () => {
    await listLibrary("user-a", { query: "coding" });

    expect(db.libraryItem.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            expect.objectContaining({
              OR: expect.arrayContaining([{ tags: { has: "Coding" } }]),
            }),
          ],
        }),
      }),
    );
  });
});

describe("saveLibraryItem", () => {
  const input: LibraryItemInput = {
    title: item.title,
    description: item.description,
    link: item.link,
    tags: ["Documentation", "Coding"],
  };

  it("scopes a new item to the authenticated user", async () => {
    await expect(saveLibraryItem("user-a", input)).resolves.toMatchObject({
      created: true,
      item: { id: "item-1" },
    });
    expect(db.libraryItem.create).toHaveBeenCalledWith({
      data: { userId: "user-a", ...input },
    });
  });

  it("returns an existing exact link without creating a duplicate", async () => {
    db.libraryItem.findUnique.mockResolvedValueOnce(item);

    await expect(saveLibraryItem("user-a", input)).resolves.toMatchObject({
      created: false,
      item: { id: "item-1" },
    });
    expect(db.libraryItem.create).not.toHaveBeenCalled();
  });

  it("recovers when a concurrent save wins the unique-link race", async () => {
    db.libraryItem.create.mockRejectedValueOnce({ code: "P2002" });
    db.libraryItem.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(item);

    await expect(saveLibraryItem("user-a", input)).resolves.toMatchObject({
      created: false,
      item: { id: "item-1" },
    });
  });
});
