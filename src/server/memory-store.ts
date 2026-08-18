import { MEMORY_LIST_LIMIT, type UserMemoryRecord } from "@/calendar/settings";

import { prisma } from "./db";

function toRecord(row: {
  id: string;
  content: string;
  createdAt: Date;
}): UserMemoryRecord {
  return {
    id: row.id,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listMemories(
  userId: string,
  { limit = MEMORY_LIST_LIMIT }: { limit?: number | null } = {},
): Promise<UserMemoryRecord[]> {
  const rows = await prisma.userMemory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit ?? undefined,
  });
  return rows.map(toRecord);
}

export async function addMemory(
  userId: string,
  content: string,
): Promise<UserMemoryRecord> {
  const row = await prisma.userMemory.create({ data: { userId, content } });
  return toRecord(row);
}

export async function removeMemory(
  userId: string,
  memoryId: string,
): Promise<boolean> {
  const { count } = await prisma.userMemory.deleteMany({
    where: { id: memoryId, userId },
  });
  return count > 0;
}
