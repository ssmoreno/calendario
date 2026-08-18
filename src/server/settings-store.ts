import {
  toUserSettings,
  type UserSettings,
  type UserSettingsPatch,
} from "@/calendar/settings";

import { prisma } from "./db";

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const row = await prisma.userSettings.findUnique({ where: { userId } });
  return toUserSettings(row);
}

export async function updateUserSettings(
  userId: string,
  patch: UserSettingsPatch,
): Promise<UserSettings> {
  const row = await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...patch },
    update: patch,
  });
  return toUserSettings(row);
}
