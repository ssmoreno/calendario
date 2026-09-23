import { prisma } from "./db";

export async function cleanupExpiredChatState(now = new Date()): Promise<void> {
  await Promise.all([
    prisma.chatStateLock.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.chatStateCache.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.chatStateList.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.chatStateQueue.deleteMany({ where: { expiresAt: { lte: now } } }),
  ]);
}
