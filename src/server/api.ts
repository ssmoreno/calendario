import { NextResponse } from "next/server";

import { messages } from "@/calendar/messages";

import { getSession } from "./session";

export async function currentUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user.id ?? null;
}

export function unauthorized() {
  return NextResponse.json(
    { error: messages.settings.signInRequired },
    { status: 401 },
  );
}

export function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
