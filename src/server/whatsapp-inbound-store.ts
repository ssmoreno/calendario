import { prisma } from "./db";

export async function recordInboundMessage(
  threadId: string,
  messageId: string,
): Promise<void> {
  await prisma.whatsAppInboundMessage.upsert({
    where: { threadId },
    create: { threadId, messageId },
    update: { messageId },
  });
}

export async function latestInboundMessageId(
  threadId: string,
): Promise<string | null> {
  const row = await prisma.whatsAppInboundMessage.findUnique({
    where: { threadId },
  });
  return row?.messageId ?? null;
}
