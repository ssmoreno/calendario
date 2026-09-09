import { z } from "zod";

export const LIBRARY_TAGS = [
  "Article",
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

export const libraryTagSchema = z.enum(LIBRARY_TAGS);

export const libraryTagsSchema = z
  .array(libraryTagSchema)
  .min(1, "Choose at least one broad tag.")
  .max(3, "Choose no more than three broad tags.")
  .refine((tags) => new Set(tags).size === tags.length, "Choose each tag once.");

export const libraryItemSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(2_000),
  link: z
    .string()
    .trim()
    .max(2_048)
    .url()
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    }, "Use a full http or https link."),
  tags: libraryTagsSchema,
});

export const linkCurationSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    title: libraryItemSchema.shape.title,
    description: libraryItemSchema.shape.description,
    tags: libraryTagsSchema,
  }),
  z.object({
    status: z.literal("unreadable"),
    reason: z.string().trim().min(1).max(240),
  }),
]);

export type LibraryTag = z.infer<typeof libraryTagSchema>;
export type LibraryItemInput = z.infer<typeof libraryItemSchema>;

export interface LibraryItemRecord {
  id: string;
  title: string;
  description: string;
  link: string;
  tags: string[];
  createdAt: string;
}

export interface LibraryResult {
  items: LibraryItemRecord[];
  availableTags: string[];
  totalCount: number;
}
