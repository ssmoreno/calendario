import type { Prisma } from "@/generated/prisma/client";
import {
  normalizeLibraryItemTitle,
  normalizeLibraryTagName,
  type LibraryItemChanges,
  type LibraryItemInput,
  type LibraryItemRecord,
  type LibraryResult,
  type LibraryTagRecord,
} from "@/library/types";

import { prisma } from "./db";

export class LibraryItemNotFoundError extends Error {
  constructor() {
    super("Library item not found.");
  }
}

export class LibraryLinkTakenError extends Error {
  constructor() {
    super("Another library item already uses that link.");
  }
}

export class LibraryTagNotFoundError extends Error {
  constructor() {
    super("Library tag not found.");
  }
}

export class LibraryTagNameTakenError extends Error {
  constructor() {
    super("Another library tag already uses that name.");
  }
}

interface LibraryItemRow {
  id: string;
  title: string;
  description: string;
  summary: string | null;
  link: string | null;
  tags: Array<{ tag: { name: string } }>;
  createdAt: Date;
}

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

function toItemRecord(row: LibraryItemRow): LibraryItemRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    summary: row.summary,
    link: row.link,
    tags: row.tags.map(({ tag }) => tag.name).sort((a, b) => a.localeCompare(b)),
    createdAt: row.createdAt.toISOString(),
  };
}

function toTagRecord(row: {
  id: string;
  name: string;
  createdAt: Date;
  _count: { items: number };
}): LibraryTagRecord {
  return {
    id: row.id,
    name: row.name,
    itemCount: row._count.items,
    createdAt: row.createdAt.toISOString(),
  };
}

const itemTags = {
  include: { tag: { select: { name: true } } },
} as const;

interface LibraryFilters {
  query?: string;
  tags?: string[];
}

interface SaveLibraryItemOptions {
  dedupeUnlinkedByTitle?: boolean;
}

function searchTerms(query: string | undefined): string[] {
  return query?.trim().split(/\s+/).filter(Boolean).slice(0, 8) ?? [];
}

function searchFilter(term: string) {
  return {
    OR: [
      { title: { contains: term, mode: "insensitive" as const } },
      { description: { contains: term, mode: "insensitive" as const } },
      { summary: { contains: term, mode: "insensitive" as const } },
      { link: { contains: term, mode: "insensitive" as const } },
      {
        tags: {
          some: {
            tag: { name: { contains: term, mode: "insensitive" as const } },
          },
        },
      },
    ],
  };
}

function tagFilter(name: string) {
  return {
    tags: {
      some: { tag: { normalizedName: normalizeLibraryTagName(name) } },
    },
  };
}

export async function listLibrary(
  userId: string,
  { query, tags = [] }: LibraryFilters = {},
): Promise<LibraryResult> {
  const filters = [
    ...searchTerms(query).map(searchFilter),
    ...tags.map(tagFilter),
  ];
  const where = {
    userId,
    ...(filters.length ? { AND: filters } : {}),
  };
  const [items, availableTags, totalCount] = await Promise.all([
    prisma.libraryItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { tags: itemTags },
    }),
    prisma.libraryTag.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    prisma.libraryItem.count({ where: { userId } }),
  ]);
  return {
    items: items.map(toItemRecord),
    availableTags: availableTags.map(({ name }) => name),
    totalCount,
  };
}

export async function findLibraryItem(
  userId: string,
  id: string,
): Promise<LibraryItemRecord | null> {
  const item = await prisma.libraryItem.findUnique({
    where: { id_userId: { id, userId } },
    include: { tags: itemTags },
  });
  return item ? toItemRecord(item) : null;
}

export async function listLibraryTags(
  userId: string,
): Promise<LibraryTagRecord[]> {
  const tags = await prisma.libraryTag.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true } } },
  });
  return tags.map(toTagRecord);
}

async function upsertTags(
  tx: Prisma.TransactionClient,
  userId: string,
  names: string[],
) {
  return Promise.all(
    names.map((name) =>
      tx.libraryTag.upsert({
        where: {
          userId_normalizedName: {
            userId,
            normalizedName: normalizeLibraryTagName(name),
          },
        },
        create: {
          userId,
          name,
          normalizedName: normalizeLibraryTagName(name),
        },
        update: {},
        select: { id: true },
      }),
    ),
  );
}

export async function saveLibraryItem(
  userId: string,
  input: LibraryItemInput,
  { dedupeUnlinkedByTitle = false }: SaveLibraryItemOptions = {},
): Promise<{ created: boolean; item: LibraryItemRecord }> {
  const attachmentIdentity =
    !input.link && dedupeUnlinkedByTitle
      ? normalizeLibraryItemTitle(input.title)
      : null;
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = input.link
        ? await tx.libraryItem.findUnique({
            where: { userId_link: { userId, link: input.link } },
            include: { tags: itemTags },
          })
        : attachmentIdentity
          ? await tx.libraryItem.findUnique({
              where: {
                userId_attachmentIdentity: { userId, attachmentIdentity },
              },
              include: { tags: itemTags },
            })
          : null;
      if (existing) return { created: false, item: toItemRecord(existing) };

      const tags = await upsertTags(tx, userId, input.tags);
      const created = await tx.libraryItem.create({
        data: {
          userId,
          title: input.title,
          description: input.description,
          summary: input.summary,
          link: input.link,
          attachmentIdentity,
          tags: {
            createMany: { data: tags.map(({ id: tagId }) => ({ tagId })) },
          },
        },
        include: { tags: itemTags },
      });
      return { created: true, item: toItemRecord(created) };
    });
  } catch (error) {
    if (!isPrismaError(error, "P2002")) throw error;
    const raced = input.link
      ? await prisma.libraryItem.findUnique({
          where: { userId_link: { userId, link: input.link } },
          include: { tags: itemTags },
        })
      : attachmentIdentity
        ? await prisma.libraryItem.findUnique({
            where: {
              userId_attachmentIdentity: { userId, attachmentIdentity },
            },
            include: { tags: itemTags },
          })
        : null;
    if (!raced) throw error;
    return { created: false, item: toItemRecord(raced) };
  }
}

export async function updateLibraryItem(
  userId: string,
  itemId: string,
  changes: LibraryItemChanges,
): Promise<LibraryItemRecord> {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.libraryItem.findUnique({
        where: { id_userId: { id: itemId, userId } },
        select: { id: true },
      });
      if (!existing) throw new LibraryItemNotFoundError();

      const tags = changes.tags
        ? await upsertTags(tx, userId, changes.tags)
        : undefined;
      if (tags) {
        await tx.libraryItemTag.deleteMany({ where: { itemId, userId } });
        await tx.libraryItemTag.createMany({
          data: tags.map(({ id: tagId }) => ({ itemId, tagId, userId })),
        });
      }

      const updated = await tx.libraryItem.update({
        where: { id_userId: { id: itemId, userId } },
        data: {
          title: changes.title,
          description: changes.description,
          summary: changes.summary,
          link: changes.link,
        },
        include: { tags: itemTags },
      });
      return toItemRecord(updated);
    });
  } catch (error) {
    if (error instanceof LibraryItemNotFoundError) throw error;
    if (isPrismaError(error, "P2002")) throw new LibraryLinkTakenError();
    if (isPrismaError(error, "P2025")) throw new LibraryItemNotFoundError();
    throw error;
  }
}

export async function deleteLibraryItem(
  userId: string,
  itemId: string,
): Promise<LibraryItemRecord> {
  try {
    const deleted = await prisma.libraryItem.delete({
      where: { id_userId: { id: itemId, userId } },
      include: { tags: itemTags },
    });
    return toItemRecord(deleted);
  } catch (error) {
    if (isPrismaError(error, "P2025")) throw new LibraryItemNotFoundError();
    throw error;
  }
}

export async function createLibraryTag(
  userId: string,
  name: string,
): Promise<{ created: boolean; tag: LibraryTagRecord }> {
  const normalizedName = normalizeLibraryTagName(name);
  try {
    const tag = await prisma.libraryTag.create({
      data: { userId, name, normalizedName },
      include: { _count: { select: { items: true } } },
    });
    return { created: true, tag: toTagRecord(tag) };
  } catch (error) {
    if (!isPrismaError(error, "P2002")) throw error;
    const existing = await prisma.libraryTag.findUnique({
      where: { userId_normalizedName: { userId, normalizedName } },
      include: { _count: { select: { items: true } } },
    });
    if (!existing) throw error;
    return { created: false, tag: toTagRecord(existing) };
  }
}

export async function renameLibraryTag(
  userId: string,
  tagId: string,
  name: string,
): Promise<LibraryTagRecord> {
  try {
    const tag = await prisma.libraryTag.update({
      where: { id_userId: { id: tagId, userId } },
      data: { name, normalizedName: normalizeLibraryTagName(name) },
      include: { _count: { select: { items: true } } },
    });
    return toTagRecord(tag);
  } catch (error) {
    if (isPrismaError(error, "P2002")) throw new LibraryTagNameTakenError();
    if (isPrismaError(error, "P2025")) throw new LibraryTagNotFoundError();
    throw error;
  }
}

export async function deleteLibraryTag(
  userId: string,
  tagId: string,
): Promise<LibraryTagRecord> {
  try {
    const tag = await prisma.libraryTag.delete({
      where: { id_userId: { id: tagId, userId } },
      include: { _count: { select: { items: true } } },
    });
    return toTagRecord(tag);
  } catch (error) {
    if (isPrismaError(error, "P2025")) throw new LibraryTagNotFoundError();
    throw error;
  }
}
