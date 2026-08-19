import {
  SAVED_ITEM_LIST_LIMIT,
  toSavedItemRecord,
  urlDomain,
  type SavedItemKind,
  type SavedItemRecord,
} from "@/library/types";

import { prisma } from "./db";

export interface SaveItemInput {
  url: string;
  kind: SavedItemKind;
  note: string | null;
  title: string | null;
  summary: string | null;
}

/**
 * Sending the same link twice updates it rather than stacking duplicates, so a
 * second send with a better note or a title that resolved this time wins.
 */
export async function saveItem(
  userId: string,
  { url, kind, note, title, summary }: SaveItemInput,
): Promise<SavedItemRecord> {
  const domain = urlDomain(url);
  const row = await prisma.savedItem.upsert({
    where: { userId_url: { userId, url } },
    create: { userId, url, domain, kind, note, title, summary },
    update: {
      kind,
      ...(note !== null && { note }),
      ...(title !== null && { title }),
      ...(summary !== null && { summary }),
    },
  });
  return toSavedItemRecord(row);
}

export async function listSavedItems(
  userId: string,
  {
    kind,
    query,
    limit = SAVED_ITEM_LIST_LIMIT,
  }: { kind?: SavedItemKind; query?: string; limit?: number | null } = {},
): Promise<SavedItemRecord[]> {
  const search = query?.trim();
  const rows = await prisma.savedItem.findMany({
    where: {
      userId,
      ...(kind && { kind }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { summary: { contains: search, mode: "insensitive" as const } },
          { note: { contains: search, mode: "insensitive" as const } },
          { domain: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
    take: limit ?? undefined,
  });
  return rows.map(toSavedItemRecord);
}

export async function removeSavedItem(
  userId: string,
  itemId: string,
): Promise<boolean> {
  const { count } = await prisma.savedItem.deleteMany({
    where: { id: itemId, userId },
  });
  return count > 0;
}
