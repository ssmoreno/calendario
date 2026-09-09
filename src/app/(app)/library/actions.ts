"use server";

import { revalidatePath } from "next/cache";

import { libraryItemSchema } from "@/library/types";
import { saveLibraryItem } from "@/server/library-store";
import { requireSession } from "@/server/session";

export interface LibraryActionState {
  error?: string;
  success?: string;
}

export async function createLibraryItemAction(
  _state: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  const note = String(formData.get("note") ?? "").trim();
  const link = String(formData.get("link") ?? "").trim();
  const parsed = libraryItemSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    note: note || undefined,
    link: link || undefined,
    tags: formData.getAll("tags"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the item details." };
  }

  const session = await requireSession();
  const result = await saveLibraryItem(session.user.id, parsed.data);
  revalidatePath("/library");
  return { success: result.created ? "Item added." : "Item already saved." };
}
