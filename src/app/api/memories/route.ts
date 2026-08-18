import { NextResponse } from "next/server";

import { currentUserId, unauthorized } from "@/server/api";
import { listMemories } from "@/server/memory-store";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  return NextResponse.json({
    memories: await listMemories(userId, { limit: null }),
  });
}
