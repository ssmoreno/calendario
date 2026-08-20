import { describe, expect, it } from "vitest";

import {
  loadPreferences,
  PREFERENCES_STORAGE_KEY,
  saveThemePreference,
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

describe("theme preference storage", () => {
  it("persists revisions and recovers malformed preferences", () => {
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
      theme: "dark",
    });
    expect(storage.getItem(PREFERENCES_STORAGE_KEY)).toBeNull();
  });
});
