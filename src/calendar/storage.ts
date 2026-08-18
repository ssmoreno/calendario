import { preferencesDocumentSchema } from "./schemas";
import type { PreferencesDocument, ThemePreference } from "./types";

export const PREFERENCES_STORAGE_KEY = "calendario.preferences.v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function loadPreferences(
  storage: StorageLike | null,
  now = new Date(),
): PreferencesDocument {
  const fallback: PreferencesDocument = {
    version: 1,
    revision: 0,
    theme: "system",
  };
  if (!storage) return fallback;
  let raw: string | null;
  try {
    raw = storage.getItem(PREFERENCES_STORAGE_KEY);
  } catch {
    return fallback;
  }
  if (!raw) return fallback;
  try {
    return preferencesDocumentSchema.parse(JSON.parse(raw));
  } catch {
    try {
      storage.setItem(
        `${PREFERENCES_STORAGE_KEY}.corrupt.${now.getTime()}`,
        raw,
      );
      storage.removeItem(PREFERENCES_STORAGE_KEY);
    } catch {
      return fallback;
    }
    return fallback;
  }
}

export function saveThemePreference(
  storage: StorageLike | null,
  theme: ThemePreference,
): PreferencesDocument {
  const current = loadPreferences(storage);
  const next: PreferencesDocument = {
    version: 1,
    revision: current.revision + 1,
    theme,
  };
  try {
    storage?.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    return next;
  }
  return next;
}
