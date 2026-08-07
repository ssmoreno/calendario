import { describe, expect, it } from "vitest";

import {
  EVENTS_STORAGE_KEY,
  loadCalendarDocument,
  loadPreferences,
  parseCalendarImport,
  PREFERENCES_STORAGE_KEY,
  saveThemePreference,
  serializeCalendarExport,
  type StorageLike,
} from "./storage";

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("calendar storage", () => {
  it("falls back to memory when browser storage is unavailable", () => {
    expect(loadCalendarDocument(null)).toMatchObject({
      recoveredCorruptData: false,
      storageAvailable: false,
      document: { version: 1, revision: 0, events: [] },
    });
  });

  it("backs up a corrupt payload and recovers with an empty calendar", () => {
    const storage = new MemoryStorage();
    storage.setItem(EVENTS_STORAGE_KEY, "not-json");
    const now = new Date("2026-08-06T12:00:00.000Z");

    const result = loadCalendarDocument(storage, [], now);

    expect(result.recoveredCorruptData).toBe(true);
    expect(result.document.events).toEqual([]);
    expect(storage.getItem(EVENTS_STORAGE_KEY)).toBeNull();
    expect(
      storage.getItem(`${EVENTS_STORAGE_KEY}.corrupt.${now.getTime()}`),
    ).toBe("not-json");
  });

  it("round-trips versioned exports", () => {
    const document = {
      version: 1 as const,
      revision: 4,
      updatedAt: "2026-08-06T12:00:00.000Z",
      events: [],
    };

    expect(parseCalendarImport(serializeCalendarExport(document))).toEqual(document);
  });

  it("rejects malformed or unsupported imports", () => {
    expect(() => parseCalendarImport("not-json")).toThrow();
    expect(() =>
      parseCalendarImport(
        JSON.stringify({
          version: 2,
          revision: 0,
          updatedAt: "2026-08-06T12:00:00.000Z",
          events: [],
        }),
      ),
    ).toThrow();
  });

  it("persists theme revisions and recovers malformed preferences", () => {
    const storage = new MemoryStorage();
    const light = saveThemePreference(storage, "light");
    const dark = saveThemePreference(storage, "dark");

    expect(light).toMatchObject({ theme: "light", revision: 1 });
    expect(dark).toMatchObject({ theme: "dark", revision: 2 });
    expect(loadPreferences(storage)).toEqual(dark);

    storage.setItem(PREFERENCES_STORAGE_KEY, "malformed");
    const recoveryTime = new Date("2026-08-07T12:00:00.000Z");
    expect(loadPreferences(storage, recoveryTime)).toEqual({
      version: 1,
      revision: 0,
      theme: "system",
    });
    expect(storage.getItem(PREFERENCES_STORAGE_KEY)).toBeNull();
    expect(
      storage.getItem(
        `${PREFERENCES_STORAGE_KEY}.corrupt.${recoveryTime.getTime()}`,
      ),
    ).toBe("malformed");
  });
});
