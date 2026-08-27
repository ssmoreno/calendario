import { NextResponse } from "next/server";

import { currentUserId, unauthorized } from "@/server/api";
import {
  activePairingCode,
  linkedWaId,
  mintPairingCode,
  unlinkWhatsApp,
} from "@/server/whatsapp-link-store";

export interface WhatsAppLinkStatus {
  waId: string | null;
  code: string | null;
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const [waId, pairing] = await Promise.all([
    linkedWaId(userId),
    activePairingCode(userId),
  ]);
  return NextResponse.json({ waId, code: waId ? null : pairing?.code ?? null });
}

export async function POST() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { code } = await mintPairingCode(userId);
  return NextResponse.json({ waId: null, code });
}

export async function DELETE() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await unlinkWhatsApp(userId);
  return NextResponse.json({ waId: null, code: null });
}
