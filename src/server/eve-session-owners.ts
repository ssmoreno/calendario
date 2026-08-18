import { prisma } from "./db";

export async function getEveSessionOwner(
  sessionId: string,
): Promise<string | null> {
  const row = await prisma.eveSessionOwner.findUnique({ where: { sessionId } });
  return row?.userId ?? null;
}

export async function claimEveSession(
  sessionId: string,
  userId: string,
): Promise<void> {
  const owner = await prisma.eveSessionOwner.upsert({
    where: { sessionId },
    create: { sessionId, userId },
    update: {},
    select: { userId: true },
  });
  if (owner.userId !== userId) {
    throw new Error("Eve session ownership is already claimed.");
  }
}
