import { z } from "zod";

/**
 * What the user sent a link for. The agent picks one when the user's words or
 * the page make it obvious, and falls back to "link" when they don't.
 */
export const SAVED_ITEM_KINDS = [
  "link",
  "article",
  "recipe",
  "video",
] as const;

export type SavedItemKind = (typeof SAVED_ITEM_KINDS)[number];

export const MAX_SAVED_NOTE_LENGTH = 2_000;
export const SAVED_ITEM_LIST_LIMIT = 50;

export interface SavedItemRecord {
  id: string;
  url: string;
  domain: string;
  title: string | null;
  summary: string | null;
  kind: SavedItemKind;
  note: string | null;
  createdAt: string;
}

export const savedItemKindSchema = z.enum(SAVED_ITEM_KINDS);

export const savedNoteSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_SAVED_NOTE_LENGTH);

export const savedItemUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .refine(isHttpUrl, "Use a full http or https link.");

export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The visible host, used both for display and as a search term, so "that thing
 * from nytimes" finds the item even when the title fetch failed.
 */
export function urlDomain(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

interface StoredSavedItem {
  id: string;
  url: string;
  domain: string;
  title: string | null;
  summary: string | null;
  kind: string;
  note: string | null;
  createdAt: Date;
}

/** Rows can outlive the kinds the app accepts, so an unreadable one reads as a plain link. */
export function toSavedItemRecord(row: StoredSavedItem): SavedItemRecord {
  const kind = savedItemKindSchema.safeParse(row.kind);
  return {
    id: row.id,
    url: row.url,
    domain: row.domain,
    title: row.title,
    summary: row.summary,
    kind: kind.success ? kind.data : "link",
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}
