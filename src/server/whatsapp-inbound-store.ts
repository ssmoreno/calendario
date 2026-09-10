import { prisma } from "./db";

/** One inbound message a turn may acknowledge, in arrival order. */
export interface InboundMessage {
  messageId: string;
  preview: string;
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

/** The batch the running turn was shown, read back when its reply arrives. */
export async function shownInboundBatch(
  threadId: string,
): Promise<InboundMessage[]> {
  const rows = await prisma.whatsAppInboundMessage.findMany({
    where: { threadId, shownAt: { not: null } },
    orderBy: [{ shownAt: "desc" }, { receivedAt: "asc" }],
    select: { messageId: true, preview: true, shownAt: true },
  });
  // A turn that died before replying can leave an older batch behind, and its
  // rows would shift the numbering the model was given.
  const claimedAt = rows[0]?.shownAt;
  if (!claimedAt) return [];
  return rows
    .filter((row) => row.shownAt?.getTime() === claimedAt.getTime())
    .map(({ messageId, preview }) => ({ messageId, preview }));
}

/** Retires every message a reply has now answered, ticked or not. */
export async function clearShownInboundMessages(
  threadId: string,
): Promise<void> {
  await prisma.whatsAppInboundMessage.deleteMany({
    where: { threadId, shownAt: { not: null } },
  });
}
