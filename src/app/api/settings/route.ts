import { NextResponse } from "next/server";

import { settingsPatchSchema } from "@/calendar/settings";
import { badRequest, currentUserId, unauthorized } from "@/server/api";
import { getUserSettings, updateUserSettings } from "@/server/settings-store";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  return NextResponse.json({ settings: await getUserSettings(userId) });
}

export async function PATCH(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const body: unknown = await request.json().catch(() => null);
  const patch = settingsPatchSchema.safeParse(body);
  if (!patch.success) {
    return badRequest(patch.error.issues[0]?.message ?? "Invalid settings.");
  }

  return NextResponse.json({
    settings: await updateUserSettings(userId, patch.data),
  });
}
