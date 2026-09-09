import { LIBRARY_TAGS } from "@/library/types";
import type {
  LibraryItemInput,
  LibraryItemRecord,
  LibraryResult,
} from "@/library/types";

import { prisma } from "./db";

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
  title: string;
  description: string;
  summary: string | null;
  link: string;
  tags: string[];
  createdAt: Date;
}): LibraryItemRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    summary: row.summary,
    link: row.link,
    tags: row.tags,
    createdAt: row.createdAt.toISOString(),
  };
}

interface LibraryFilters {
  query?: string;
  tags?: string[];
}

function searchTerms(query: string | undefined): string[] {
  return query?.trim().split(/\s+/).filter(Boolean).slice(0, 8) ?? [];
}

function searchFilter(term: string) {
  const tag = LIBRARY_TAGS.find(
    (candidate) => candidate.toLowerCase() === term.toLowerCase(),
  );
  return {
    OR: [
      { title: { contains: term, mode: "insensitive" as const } },
      { description: { contains: term, mode: "insensitive" as const } },
      { summary: { contains: term, mode: "insensitive" as const } },
      { link: { contains: term, mode: "insensitive" as const } },
      ...(tag ? [{ tags: { has: tag } }] : []),
    ],
  };
}

export async function listLibrary(
  userId: string,
  { query, tags = [] }: LibraryFilters = {},
): Promise<LibraryResult> {
  const terms = searchTerms(query);
  const where = {
    userId,
    ...(tags.length ? { tags: { hasEvery: tags } } : {}),
    ...(terms.length
      ? {
          AND: terms.map(searchFilter),
        }
      : {}),
  };
  const [items, allTags, totalCount] = await Promise.all([
    prisma.libraryItem.findMany({ where, orderBy: { createdAt: "desc" } }),
    prisma.libraryItem.findMany({
      where: { userId },
      select: { tags: true },
    }),
    prisma.libraryItem.count({ where: { userId } }),
  ]);
  return {
    items: items.map(toItemRecord),
    availableTags: [...new Set(allTags.flatMap((item) => item.tags))].sort(
      (a, b) => a.localeCompare(b),
    ),
    totalCount,
  };
}

export async function findLibraryItem(
  userId: string,
  id: string,
): Promise<LibraryItemRecord | null> {
  const item = await prisma.libraryItem.findFirst({ where: { id, userId } });
  return item ? toItemRecord(item) : null;
}

export async function saveLibraryItem(
  userId: string,
  input: LibraryItemInput,
): Promise<{ created: boolean; item: LibraryItemRecord }> {
  const existing = await prisma.libraryItem.findUnique({
    where: { userId_link: { userId, link: input.link } },
  });
  if (existing) return { created: false, item: toItemRecord(existing) };

  try {
    return {
      created: true,
      item: toItemRecord(
        await prisma.libraryItem.create({ data: { userId, ...input } }),
      ),
    };
  } catch (error) {
    if (!isPrismaError(error, "P2002")) throw error;
    const raced = await prisma.libraryItem.findUnique({
      where: { userId_link: { userId, link: input.link } },
    });
    if (!raced) throw error;
    return { created: false, item: toItemRecord(raced) };
  }
}
