import { generatePairingCode, pairingCodeExpiry } from "@/whatsapp/pairing";

import { prisma } from "./db";

export interface PairingCode {
  code: string;
  expiresAt: Date;
}

/** The account an inbound WhatsApp sender belongs to, or null when unlinked. */
export async function linkedUserId(waId: string): Promise<string | null> {
  const row = await prisma.whatsAppLink.findUnique({ where: { waId } });
  return row?.userId ?? null;
}

export async function linkedWaId(userId: string): Promise<string | null> {
  const row = await prisma.whatsAppLink.findUnique({ where: { userId } });
  return row?.waId ?? null;
}

/** Replaces whatever code the account had, so only the newest one works. */
export async function mintPairingCode(userId: string): Promise<PairingCode> {
  const code = generatePairingCode();
  const expiresAt = pairingCodeExpiry();
  await prisma.whatsAppPairingCode.upsert({
    where: { userId },
    create: { code, userId, expiresAt },
    update: { code, expiresAt },
  });
  return { code, expiresAt };
}

export async function activePairingCode(
  userId: string,
): Promise<PairingCode | null> {
  const row = await prisma.whatsAppPairingCode.findUnique({
    where: { userId },
  });
  if (!row || row.expiresAt <= new Date()) return null;
  return { code: row.code, expiresAt: row.expiresAt };
}

/**
 * Binds the number to the account that minted the code, and returns that
 * account. Proving control of both sides is the whole authorization, so a
 * number that already belonged elsewhere moves here rather than being refused.
 */
export async function redeemPairingCode(
  code: string,
  waId: string,
): Promise<string | null> {
  const row = await prisma.whatsAppPairingCode.findUnique({ where: { code } });
  if (!row || row.expiresAt <= new Date()) return null;

  await prisma.$transaction([
    prisma.whatsAppLink.deleteMany({
      where: { OR: [{ waId }, { userId: row.userId }] },
    }),
    prisma.whatsAppLink.create({ data: { waId, userId: row.userId } }),
    prisma.whatsAppPairingCode.delete({ where: { code: row.code } }),
  ]);
  return row.userId;
}

export async function unlinkWhatsApp(userId: string): Promise<void> {
  await prisma.whatsAppLink.deleteMany({ where: { userId } });
}
