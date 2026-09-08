import type { CategoryRecord, LibraryItemRecord } from "@/library/types";

import { prisma } from "./db";

export class CategoryNameTakenError extends Error {}
export class CategoryNotFoundError extends Error {}

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

function toItemRecord(row: {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  link: string;
  createdAt: Date;
}): LibraryItemRecord {
  return {
    id: row.id,
    categoryId: row.categoryId,
    name: row.name,
    description: row.description,
    link: row.link,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listLibrary(userId: string): Promise<CategoryRecord[]> {
  const categories = await prisma.category.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { items: { orderBy: { createdAt: "desc" } } },
  });
  return categories.map(({ id, name, items }) => ({
    id,
    name,
    items: items.map(toItemRecord),
  }));
}

export async function createCategory(
  userId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  try {
    return await prisma.category.create({
      data: { userId, name },
      select: { id: true, name: true },
    });
  } catch (error) {
    if (isPrismaError(error, "P2002")) throw new CategoryNameTakenError();
    throw error;
  }
}

export async function createLibraryItem(
  userId: string,
  input: {
    categoryId: string;
    name: string;
    description: string;
    link: string;
  },
): Promise<LibraryItemRecord> {
  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, userId },
    select: { id: true },
  });
  if (!category) throw new CategoryNotFoundError();

  return toItemRecord(
    await prisma.libraryItem.create({ data: { userId, ...input } }),
  );
}
