import { prisma } from "./db";

/** One inbound message a turn may acknowledge, in arrival order. */
export interface InboundMessage {
  messageId: string;
  preview: string;
}

/** What the reply needs about the batch its turn was shown. */
export interface ShownBatch {
  messages: InboundMessage[];
  /** Whether a library save succeeded while that turn was running. */
  saved: boolean;
}

export async function recordInboundMessage(
  threadId: string,
  messageId: string,
  preview: string,
): Promise<void> {
  await prisma.whatsAppInboundMessage.upsert({
    where: { threadId_messageId: { threadId, messageId } },
    create: { threadId, messageId, preview },
    update: { preview },
  });
}

/**
 * The messages this turn is allowed to tick, oldest first. Claiming them under
 * one timestamp is what lets the reply resolve its numbers back to the same
 * batch, even when the next message lands while the turn is still running.
 */
export async function claimInboundBatch(
  threadId: string,
): Promise<InboundMessage[]> {
  const rows = await prisma.whatsAppInboundMessage.updateManyAndReturn({
    where: { threadId, shownAt: null },
    data: { shownAt: new Date() },
    select: { messageId: true, preview: true, receivedAt: true },
  });
  return rows
    .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
    .map(({ messageId, preview }) => ({ messageId, preview }));
}

/**
 * Marks the running turn as having really saved a library item. The claimed
 * batch is that turn's own scratch space, so the mark is retired with it.
 */
export async function recordLibrarySave(threadId: string): Promise<void> {
  await prisma.whatsAppInboundMessage.updateMany({
    where: { threadId, shownAt: { not: null } },
    data: { savedAt: new Date() },
  });
}

/** The batch the running turn was shown, read back when its reply arrives. */
export async function shownInboundBatch(
  threadId: string,
): Promise<ShownBatch> {
  const rows = await prisma.whatsAppInboundMessage.findMany({
    where: { threadId, shownAt: { not: null } },
    orderBy: [{ shownAt: "desc" }, { receivedAt: "asc" }],
    select: {
      messageId: true,
      preview: true,
      savedAt: true,
      shownAt: true,
    },
  });
  // A turn that died before replying can leave an older batch behind, and its
  // rows would shift the numbering the model was given.
  const claimedAt = rows[0]?.shownAt;
  if (!claimedAt) return { messages: [], saved: false };
  const batch = rows.filter(
    (row) => row.shownAt?.getTime() === claimedAt.getTime(),
  );
  return {
    messages: batch.map(({ messageId, preview }) => ({ messageId, preview })),
    saved: batch.some((row) => row.savedAt !== null),
  };
}

/** Retires every message a reply has now answered, ticked or not. */
export async function clearShownInboundMessages(
  threadId: string,
): Promise<void> {
  await prisma.whatsAppInboundMessage.deleteMany({
    where: { threadId, shownAt: { not: null } },
  });
}
