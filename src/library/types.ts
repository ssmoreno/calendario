import { z } from "zod";

export const DEFAULT_LIBRARY_TAGS = [
  "Article",
  "Book",
  "Recipe",
  "Paper",
  "Coding",
  "Video",
  "Podcast",
  "Tool",
  "Documentation",
  "Design",
  "Business",
  "Science",
  "Health",
  "Finance",
  "Travel",
  "Food",
  "News",
  "Reference",
] as const;

export const libraryTagNameSchema = z
  .string()
  .transform((name) => name.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1).max(80));

export function normalizeLibraryTagName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeLibraryItemTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

export const libraryTagsSchema = z
  .array(libraryTagNameSchema)
  .min(1, "Choose at least one broad tag.")
  .max(3, "Choose no more than three broad tags.")
  .refine(
    (tags) =>
      new Set(tags.map(normalizeLibraryTagName)).size === tags.length,
    "Choose each tag once.",
  );

export const automaticLibraryTagsSchema = libraryTagsSchema.refine(
  (tags) =>
    tags.every((tag) => DEFAULT_LIBRARY_TAGS.some((value) => value === tag)),
  "Choose only the standard broad tags.",
);

export const libraryItemIdSchema = z.string().trim().min(1);

export const libraryTagIdSchema = z.string().trim().min(1);

/**
 * The read: what the library shows instead of sending someone to the source.
 * Roughly one book page, so it stays a quick sit-down rather than an article.
 */
export const librarySummarySchema = z
  .string()
  .trim()
  .min(200, "Write a fuller read.")
  .max(2_600, "Keep the read to about one book page.");

export const libraryLinkSchema = z
  .string()
  .trim()
  .max(2_048)
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Use a full http or https link.");

export const libraryItemSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(240),
  summary: librarySummarySchema.optional(),
  link: libraryLinkSchema.optional(),
  tags: libraryTagsSchema,
});

export const libraryLinkItemSchema = libraryItemSchema.extend({
  link: libraryLinkSchema,
  tags: automaticLibraryTagsSchema,
});

export const libraryAttachmentItemSchema = libraryItemSchema
  .omit({ link: true })
  .extend({
    summary: librarySummarySchema,
    tags: automaticLibraryTagsSchema,
  });

export const linkCurationSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    title: libraryItemSchema.shape.title,
    description: libraryItemSchema.shape.description,
    summary: librarySummarySchema,
    tags: automaticLibraryTagsSchema,
  }),
  z.object({
    status: z.literal("unreadable"),
    reason: z.string().trim().min(1).max(240),
  }),
]);

export const libraryFiltersSchema = z.object({
  query: z.string().trim().min(1).max(160).optional(),
  tags: z.array(libraryTagNameSchema).max(8).optional(),
});

export const createLibraryTagSchema = z.object({
  name: libraryTagNameSchema.describe("The tag name to create."),
});

export const renameLibraryTagSchema = z.object({
  tagId: libraryTagIdSchema.describe(
    "The exact tag ID returned by list_library_tags.",
  ),
  name: libraryTagNameSchema.describe("The tag's new name."),
});

export const deleteLibraryTagSchema = z.object({
  tagId: libraryTagIdSchema.describe(
    "The exact tag ID returned by list_library_tags.",
  ),
});

export const libraryItemChangesSchema = libraryItemSchema
  .partial()
  .extend({
    link: libraryLinkSchema.nullable().optional(),
    summary: librarySummarySchema.nullable().optional(),
  })
  .refine(
    (changes) => Object.values(changes).some((value) => value !== undefined),
    "Change at least one item field.",
  );

export const updateLibraryItemSchema = z.object({
  itemId: libraryItemIdSchema.describe(
    "The exact item ID returned by list_library_items.",
  ),
  changes: libraryItemChangesSchema,
});

export const deleteLibraryItemSchema = z.object({
  itemId: libraryItemIdSchema.describe(
    "The exact item ID returned by list_library_items.",
  ),
});

export type LibraryTag = z.infer<typeof libraryTagNameSchema>;
export type LibraryItemInput = z.infer<typeof libraryItemSchema>;
export type LibraryItemChanges = z.infer<typeof libraryItemChangesSchema>;

export interface LibraryItemRecord {
  id: string;
  title: string;
  description: string;
  summary: string | null;
  link: string | null;
  tags: string[];
  createdAt: string;
}

export interface LibraryResult {
  items: LibraryItemRecord[];
  availableTags: string[];
  totalCount: number;
}

export interface LibraryTagRecord {
  id: string;
  name: string;
  itemCount: number;
  createdAt: string;
}
