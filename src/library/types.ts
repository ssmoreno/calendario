import { z } from "zod";

export const categoryNameSchema = z.string().trim().min(1).max(80);

export const libraryItemSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().min(1).max(160),
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
});

export interface LibraryItemRecord {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  link: string;
  createdAt: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  items: LibraryItemRecord[];
}
