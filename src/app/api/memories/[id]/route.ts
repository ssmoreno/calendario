import { NextResponse } from "next/server";

import { currentUserId, unauthorized } from "@/server/api";
import { removeMemory } from "@/server/memory-store";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  return NextResponse.json({ deleted: await removeMemory(userId, id) });
}
