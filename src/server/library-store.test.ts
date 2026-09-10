import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LibraryItemInput } from "@/library/types";

const createdAt = new Date("2026-09-08T12:00:00.000Z");
const item = {
  id: "item-1",
  userId: "user-a",
  title: "Prisma guide",
  description: "Database reference",
  note: "A short read about type-safe queries.",
  link: "https://example.com/prisma",
  tags: [
    { tag: { name: "Documentation" } },
    { tag: { name: "Coding" } },
  ],
  createdAt,
  updatedAt: createdAt,
};
const tag = {
  id: "tag-1",
  userId: "user-a",
  name: "Documentation",
  normalizedName: "documentation",
  createdAt,
  updatedAt: createdAt,
  _count: { items: 1 },
};

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  libraryItem: {
    count: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  libraryItemTag: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  libraryTag: {
    create: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("./db", () => ({ prisma: db }));

import {
  createLibraryTag,
  deleteLibraryItem,
  deleteLibraryTag,
  findLibraryItem,
  isLibraryLinkSaved,
  LibraryItemNotFoundError,
  LibraryLinkTakenError,
  LibraryTagNameTakenError,
  listLibrary,
  listLibraryTags,
  renameLibraryTag,
  saveLibraryItem,
  updateLibraryItem,
} from "./library-store";

beforeEach(() => {
  for (const model of [db.libraryItem, db.libraryItemTag, db.libraryTag]) {
    for (const method of Object.values(model)) method.mockReset();
  }
  db.$transaction.mockReset().mockImplementation((run) => run(db));
  db.libraryItem.count.mockResolvedValue(1);
  db.libraryItem.create.mockResolvedValue(item);
  db.libraryItem.delete.mockResolvedValue(item);
  db.libraryItem.findMany.mockResolvedValue([item]);
  db.libraryItem.findUnique.mockResolvedValue(null);
  db.libraryItem.update.mockResolvedValue(item);
  db.libraryItemTag.createMany.mockResolvedValue({ count: 2 });
  db.libraryItemTag.deleteMany.mockResolvedValue({ count: 2 });
  db.libraryTag.create.mockResolvedValue(tag);
  db.libraryTag.delete.mockResolvedValue(tag);
  db.libraryTag.findMany.mockResolvedValue([
    { name: "Coding" },
    { name: "Documentation" },
  ]);
  db.libraryTag.findUnique.mockResolvedValue(null);
  db.libraryTag.update.mockResolvedValue(tag);
  db.libraryTag.upsert.mockImplementation(({ create }) =>
    Promise.resolve({ id: `tag-${create.normalizedName}` }),
  );
});

describe("findLibraryItem", () => {
  it("only returns an item owned by the authenticated user", async () => {
    db.libraryItem.findUnique.mockResolvedValueOnce(item);

    await expect(findLibraryItem("user-a", "item-1")).resolves.toMatchObject({
      id: "item-1",
      createdAt: createdAt.toISOString(),
    });
    expect(db.libraryItem.findUnique).toHaveBeenCalledWith({
      where: { id_userId: { id: "item-1", userId: "user-a" } },
      include: {
        tags: { include: { tag: { select: { name: true } } } },
      },
    });
  });

  it("returns null when no owned item exists", async () => {
    await expect(findLibraryItem("user-a", "missing")).resolves.toBeNull();
  });
});

describe("isLibraryLinkSaved", () => {
  it("finds an exact saved link for the authenticated user", async () => {
    db.libraryItem.findUnique.mockResolvedValueOnce({ id: "item-1" });

    await expect(
      isLibraryLinkSaved("user-a", " https://example.com/prisma "),
    ).resolves.toBe(true);
    expect(db.libraryItem.findUnique).toHaveBeenCalledWith({
      where: {
        userId_link: {
          userId: "user-a",
          link: "https://example.com/prisma",
        },
      },
      select: { id: true },
    });
  });

  it("rejects non-link messages without querying the library", async () => {
    await expect(isLibraryLinkSaved("user-a", "save this note")).resolves.toBe(
      false,
    );
    expect(db.libraryItem.findUnique).not.toHaveBeenCalled();
  });
});

describe("listLibrary", () => {
  it("returns flat items, available tags, and serialized dates", async () => {
    await expect(listLibrary("user-a")).resolves.toEqual({
      items: [
        {
          id: "item-1",
          title: "Prisma guide",
          description: "Database reference",
          note: "A short read about type-safe queries.",
          link: "https://example.com/prisma",
          tags: ["Coding", "Documentation"],
          createdAt: createdAt.toISOString(),
        },
      ],
      availableTags: ["Coding", "Documentation"],
      totalCount: 1,
    });
    expect(db.libraryItem.findMany).toHaveBeenCalledWith({
      where: { userId: "user-a" },
      orderBy: { createdAt: "desc" },
      include: {
        tags: { include: { tag: { select: { name: true } } } },
      },
    });
  });

  it("requires every query term and selected tag", async () => {
    await listLibrary("user-a", {
      query: "database guide",
      tags: ["Coding", "Documentation"],
    });

    expect(db.libraryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-a",
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { title: { contains: "database", mode: "insensitive" } },
              ]),
            }),
            { tags: { some: { tag: { normalizedName: "coding" } } } },
            {
              tags: {
                some: { tag: { normalizedName: "documentation" } },
              },
            },
          ]),
        },
      }),
    );
  });

  it("searches custom tag names as well as item text", async () => {
    await listLibrary("user-a", { query: "personal" });

    expect(db.libraryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            expect.objectContaining({
              OR: expect.arrayContaining([
                {
                  tags: {
                    some: {
                      tag: {
                        name: { contains: "personal", mode: "insensitive" },
                      },
                    },
                  },
                },
              ]),
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
    note: item.note,
    link: item.link,
    tags: ["Documentation", "Coding"],
  };

  it("creates tags and an item within the authenticated user's transaction", async () => {
    await expect(saveLibraryItem("user-a", input)).resolves.toMatchObject({
      created: true,
      item: { id: "item-1" },
    });
    expect(db.libraryTag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_normalizedName: {
            userId: "user-a",
            normalizedName: "documentation",
          },
        },
      }),
    );
    expect(db.libraryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-a",
          title: item.title,
          note: item.note,
          tags: {
            createMany: {
              data: [
                { tagId: "tag-documentation" },
                { tagId: "tag-coding" },
              ],
            },
          },
        }),
      }),
    );
  });

  it("returns an existing exact link without changing its tags", async () => {
    db.libraryItem.findUnique.mockResolvedValueOnce(item);

    await expect(saveLibraryItem("user-a", input)).resolves.toMatchObject({
      created: false,
      item: { id: "item-1" },
    });
    expect(db.libraryTag.upsert).not.toHaveBeenCalled();
    expect(db.libraryItem.create).not.toHaveBeenCalled();
  });

  it("creates an unlinked item without looking up a link", async () => {
    const unlinked = { ...item, link: null, tags: [{ tag: { name: "Book" } }] };
    db.libraryItem.create.mockResolvedValueOnce(unlinked);

    await expect(
      saveLibraryItem("user-a", {
        title: "To Kill a Mockingbird",
        description: "A novel about justice and moral courage.",
        note: "A useful reading note. ".repeat(20),
        tags: ["Book"],
      }),
    ).resolves.toMatchObject({
      created: true,
      item: { link: null, tags: ["Book"] },
    });
    expect(db.libraryItem.findUnique).not.toHaveBeenCalled();
    expect(db.libraryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ link: undefined }),
      }),
    );
  });

  it("deduplicates agent-created unlinked items by normalized title", async () => {
    const unlinked = { ...item, link: null, tags: [{ tag: { name: "Book" } }] };
    db.libraryItem.findUnique.mockResolvedValueOnce(unlinked);

    await expect(
      saveLibraryItem(
        "user-a",
        {
          title: "  To Kill a   Mockingbird ",
          description: "A novel about justice and moral courage.",
          note: "A useful reading note. ".repeat(20),
          tags: ["Book"],
        },
        { dedupeByTitle: true },
      ),
    ).resolves.toMatchObject({
      created: false,
      item: { link: null, tags: ["Book"] },
    });
    expect(db.libraryItem.findUnique).toHaveBeenCalledWith({
      where: {
        userId_unlinkedIdentity: {
          userId: "user-a",
          unlinkedIdentity: "to kill a mockingbird",
        },
      },
      include: expect.any(Object),
    });
    expect(db.libraryItem.create).not.toHaveBeenCalled();
  });

  it("keeps deduplicating by title when the same book carries a store link", async () => {
    const stored = {
      ...item,
      link: "https://www.amazon.com/dp/0060935464",
      tags: [{ tag: { name: "Book" } }],
    };
    db.libraryItem.findUnique.mockResolvedValueOnce(stored);

    await expect(
      saveLibraryItem(
        "user-a",
        {
          title: "To Kill a Mockingbird",
          description: "A novel about justice and moral courage.",
          link: "https://www.amazon.com/dp/0061120081",
          tags: ["Book"],
        },
        { dedupeByTitle: true },
      ),
    ).resolves.toMatchObject({ created: false, item: { id: "item-1" } });
    expect(db.libraryItem.findUnique).toHaveBeenCalledTimes(1);
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

describe("library item mutations", () => {
  it("replaces an item's full tag set and updates its fields", async () => {
    db.libraryItem.findUnique.mockResolvedValueOnce({ id: item.id });

    await expect(
      updateLibraryItem("user-a", item.id, {
        title: "Updated guide",
        note: null,
        tags: ["Reference"],
      }),
    ).resolves.toMatchObject({ id: item.id });

    expect(db.libraryItem.findUnique).toHaveBeenCalledWith({
      where: { id_userId: { id: item.id, userId: "user-a" } },
      select: { id: true },
    });
    expect(db.libraryItemTag.deleteMany).toHaveBeenCalledWith({
      where: { itemId: item.id, userId: "user-a" },
    });
    expect(db.libraryItemTag.createMany).toHaveBeenCalledWith({
      data: [
        { itemId: item.id, tagId: "tag-reference", userId: "user-a" },
      ],
    });
    expect(db.libraryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_userId: { id: item.id, userId: "user-a" } },
        data: {
          title: "Updated guide",
          description: undefined,
          note: null,
          link: undefined,
        },
      }),
    );
  });

  it("does not rewrite tags when another field changes", async () => {
    db.libraryItem.findUnique.mockResolvedValueOnce({ id: item.id });

    await updateLibraryItem("user-a", item.id, { title: "Updated guide" });

    expect(db.libraryItemTag.deleteMany).not.toHaveBeenCalled();
    expect(db.libraryItemTag.createMany).not.toHaveBeenCalled();
  });

  it("rejects an item outside the authenticated user's library", async () => {
    await expect(
      updateLibraryItem("user-b", item.id, { title: "No access" }),
    ).rejects.toBeInstanceOf(LibraryItemNotFoundError);
    expect(db.libraryItem.update).not.toHaveBeenCalled();
  });

  it("reports a duplicate link without losing the previous tags", async () => {
    db.libraryItem.findUnique.mockResolvedValueOnce({ id: item.id });
    db.libraryItem.update.mockRejectedValueOnce({ code: "P2002" });

    await expect(
      updateLibraryItem("user-a", item.id, {
        link: "https://example.com/existing",
      }),
    ).rejects.toBeInstanceOf(LibraryLinkTakenError);
  });

  it("deletes only by the authenticated user's compound key", async () => {
    await expect(deleteLibraryItem("user-a", item.id)).resolves.toMatchObject({
      id: item.id,
    });
    expect(db.libraryItem.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_userId: { id: item.id, userId: "user-a" } },
      }),
    );
  });
});

describe("library tag mutations", () => {
  it("lists tag IDs, usage counts, and serialized dates", async () => {
    db.libraryTag.findMany.mockResolvedValueOnce([tag]);

    await expect(listLibraryTags("user-a")).resolves.toEqual([
      {
        id: tag.id,
        name: tag.name,
        itemCount: 1,
        createdAt: createdAt.toISOString(),
      },
    ]);
  });

  it("creates case-insensitive user-owned tags", async () => {
    await createLibraryTag("user-a", "Reading List");

    expect(db.libraryTag.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: "user-a",
          name: "Reading List",
          normalizedName: "reading list",
        },
      }),
    );
  });

  it("returns an existing tag after a duplicate-name race", async () => {
    db.libraryTag.create.mockRejectedValueOnce({ code: "P2002" });
    db.libraryTag.findUnique.mockResolvedValueOnce(tag);

    await expect(
      createLibraryTag("user-a", "DOCUMENTATION"),
    ).resolves.toMatchObject({ created: false, tag: { id: tag.id } });
  });

  it("renames tags through an authenticated compound key", async () => {
    await renameLibraryTag("user-a", tag.id, "Docs");

    expect(db.libraryTag.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_userId: { id: tag.id, userId: "user-a" } },
        data: { name: "Docs", normalizedName: "docs" },
      }),
    );
  });

  it("rejects a rename that collides case-insensitively", async () => {
    db.libraryTag.update.mockRejectedValueOnce({ code: "P2002" });

    await expect(
      renameLibraryTag("user-a", tag.id, "Coding"),
    ).rejects.toBeInstanceOf(LibraryTagNameTakenError);
  });

  it("deletes a tag without deleting an item directly", async () => {
    await expect(deleteLibraryTag("user-a", tag.id)).resolves.toMatchObject({
      id: tag.id,
      itemCount: 1,
    });
    expect(db.libraryTag.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_userId: { id: tag.id, userId: "user-a" } },
      }),
    );
    expect(db.libraryItem.delete).not.toHaveBeenCalled();
  });
});
