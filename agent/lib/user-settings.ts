import {
  DEFAULT_USER_SETTINGS,
  type UserSettings,
} from "../../src/calendar/settings";
import { getUserSettings } from "../../src/server/settings-store";
import { maybeUserId } from "./auth";

/** The saved defaults for the account this turn belongs to. */
export async function eventDefaultsFor(
  ctx: Parameters<typeof maybeUserId>[0],
): Promise<UserSettings> {
  const userId = maybeUserId(ctx);
  if (!userId) return DEFAULT_USER_SETTINGS;
  return await getUserSettings(userId);
}
