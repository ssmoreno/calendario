import {
  calendarDocumentSchema,
  importSchema,
  preferencesDocumentSchema,
} from "./schemas";
import type {
  CalendarDocument,
  EventRecord,
  PreferencesDocument,
  ThemePreference,
} from "./types";

export const EVENTS_STORAGE_KEY = "calendario.events.v1";
export const PREFERENCES_STORAGE_KEY = "calendario.preferences.v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CalendarLoadResult {
  document: CalendarDocument;
  recoveredCorruptData: boolean;
  storageAvailable: boolean;
}

export function emptyCalendar(events: EventRecord[] = []): CalendarDocument {
  return {
    version: 1,
    revision: 0,
    updatedAt: new Date(0).toISOString(),
    events,
  };
}

export function loadCalendarDocument(
  storage: StorageLike | null,
  seedEvents: EventRecord[] = [],
  now = new Date(),
): CalendarLoadResult {
  if (!storage) {
    return {
      document: emptyCalendar(seedEvents),
      recoveredCorruptData: false,
      storageAvailable: false,
    };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(EVENTS_STORAGE_KEY);
  } catch {
    return {
      document: emptyCalendar(seedEvents),
      recoveredCorruptData: false,
      storageAvailable: false,
    };
  }

  if (!raw) {
    return {
      document: emptyCalendar(seedEvents),
      recoveredCorruptData: false,
      storageAvailable: true,
    };
  }

  try {
    const document = calendarDocumentSchema.parse(JSON.parse(raw));
    return {
      document,
      recoveredCorruptData: false,
      storageAvailable: true,
    };
  } catch {
    try {
      storage.setItem(`${EVENTS_STORAGE_KEY}.corrupt.${now.getTime()}`, raw);
      storage.removeItem(EVENTS_STORAGE_KEY);
    } catch {
      return {
        document: emptyCalendar(seedEvents),
        recoveredCorruptData: true,
        storageAvailable: false,
      };
    }
    return {
      document: emptyCalendar(seedEvents),
      recoveredCorruptData: true,
      storageAvailable: true,
    };
  }
}

export function parseCalendarImport(value: string): CalendarDocument {
  const parsed = importSchema.parse(JSON.parse(value));
  return "calendar" in parsed ? parsed.calendar : parsed;
}

export function serializeCalendarExport(document: CalendarDocument): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      calendar: document,
    },
    null,
    2,
  );
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
