"use server";

import { revalidatePath } from "next/cache";

import { categoryNameSchema, libraryItemSchema } from "@/library/types";
import {
  CategoryNameTakenError,
  CategoryNotFoundError,
  createCategory,
  createLibraryItem,
} from "@/server/library-store";
import { requireSession } from "@/server/session";

export interface LibraryActionState {
  error?: string;
  success?: string;
}

export async function createCategoryAction(
  _state: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  const parsed = categoryNameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: "Enter a category name." };

  const session = await requireSession();
  try {
    await createCategory(session.user.id, parsed.data);
  } catch (error) {
    if (error instanceof CategoryNameTakenError) {
      return { error: "You already have a category with that name." };
    }
    throw error;
  }
  revalidatePath("/library");
  return { success: "Category created." };
}

export async function createLibraryItemAction(
  _state: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  const parsed = libraryItemSchema.safeParse({
    categoryId: formData.get("categoryId"),
    name: formData.get("name"),
    description: formData.get("description"),
    link: formData.get("link"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the item details." };
  }

  const session = await requireSession();
  try {
    await createLibraryItem(session.user.id, parsed.data);
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      return { error: "That category no longer exists." };
    }
    throw error;
  }
  revalidatePath("/library");
  return { success: "Item added." };
}
