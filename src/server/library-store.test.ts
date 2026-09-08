import { beforeEach, describe, expect, it, vi } from "vitest";

const createdAt = new Date("2026-09-08T12:00:00.000Z");
const item = {
  id: "item-1",
  userId: "user-a",
  categoryId: "category-1",
  name: "Prisma guide",
  description: "Database reference",
  link: "https://example.com/prisma",
  createdAt,
  updatedAt: createdAt,
};

const db = vi.hoisted(() => ({
  category: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  libraryItem: { create: vi.fn() },
}));

vi.mock("./db", () => ({ prisma: db }));

import {
  CategoryNameTakenError,
  CategoryNotFoundError,
  createCategory,
  createLibraryItem,
  listLibrary,
} from "./library-store";

beforeEach(() => {
  db.category.create.mockReset().mockResolvedValue({
    id: "category-1",
    name: "Reference",
  });
  db.category.findFirst.mockReset().mockResolvedValue({ id: "category-1" });
  db.category.findMany.mockReset().mockResolvedValue([]);
  db.libraryItem.create.mockReset().mockResolvedValue(item);
});

describe("listLibrary", () => {
  it("returns only the user's categories and serializes item dates", async () => {
    db.category.findMany.mockResolvedValueOnce([
      { id: "category-1", name: "Reference", items: [item] },
    ]);

    await expect(listLibrary("user-a")).resolves.toEqual([
      {
        id: "category-1",
        name: "Reference",
        items: [
          {
            id: "item-1",
            categoryId: "category-1",
            name: "Prisma guide",
            description: "Database reference",
            link: "https://example.com/prisma",
            createdAt: createdAt.toISOString(),
          },
        ],
      },
    ]);
    expect(db.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-a" } }),
    );
  });
});

describe("createCategory", () => {
  it("scopes the new category to the user", async () => {
    await createCategory("user-a", "Reference");
    expect(db.category.create).toHaveBeenCalledWith({
      data: { userId: "user-a", name: "Reference" },
      select: { id: true, name: true },
    });
  });

  it("reports duplicate category names", async () => {
    db.category.create.mockRejectedValueOnce({ code: "P2002" });
    await expect(createCategory("user-a", "Reference")).rejects.toBeInstanceOf(
      CategoryNameTakenError,
    );
  });
});

describe("createLibraryItem", () => {
  it("checks category ownership before creating the item", async () => {
    await createLibraryItem("user-a", {
      categoryId: "category-1",
      name: item.name,
      description: item.description,
      link: item.link,
    });

    expect(db.category.findFirst).toHaveBeenCalledWith({
      where: { id: "category-1", userId: "user-a" },
      select: { id: true },
    });
    expect(db.libraryItem.create).toHaveBeenCalledWith({
      data: {
        userId: "user-a",
        categoryId: "category-1",
        name: item.name,
        description: item.description,
        link: item.link,
      },
    });
  });

  it("rejects a category the user does not own", async () => {
    db.category.findFirst.mockResolvedValueOnce(null);
    await expect(
      createLibraryItem("user-a", {
        categoryId: "category-b",
        name: item.name,
        description: item.description,
        link: item.link,
      }),
    ).rejects.toBeInstanceOf(CategoryNotFoundError);
    expect(db.libraryItem.create).not.toHaveBeenCalled();
  });
});
