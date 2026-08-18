export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function scopedStorageKey(baseKey: string, userId: string): string {
  return `${baseKey}.user.${encodeURIComponent(userId)}`;
}
