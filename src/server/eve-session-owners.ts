import { prisma } from "./db";

export class EveSessionOwnershipError extends Error {
  constructor() {
    super("Eve session ownership is already claimed.");
  }
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
    throw new EveSessionOwnershipError();
  }
}
