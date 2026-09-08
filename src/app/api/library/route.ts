import { NextResponse } from "next/server";

import { currentUserId, unauthorized } from "@/server/api";
import { listSavedItems } from "@/server/saved-item-store";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  return NextResponse.json({
    items: await listSavedItems(userId, { limit: null }),
  });
}
