"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  createCategoryAction,
  createLibraryItemAction,
  type LibraryActionState,
} from "@/app/(app)/library/actions";
import styles from "./library.module.css";

const INITIAL_STATE: LibraryActionState = {};

function FormStatus({ state }: { state: LibraryActionState }) {
  const message = state.error ?? state.success;
  if (!message) return null;
  return (
    <p className={styles.status} data-error={Boolean(state.error) || undefined}>
      {message}
    </p>
  );
}

export function LibraryForms({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const categoryForm = useRef<HTMLFormElement>(null);
  const itemForm = useRef<HTMLFormElement>(null);
  const [categoryState, createCategory, creatingCategory] = useActionState(
    createCategoryAction,
    INITIAL_STATE,
  );
  const [itemState, createItem, creatingItem] = useActionState(
    createLibraryItemAction,
    INITIAL_STATE,
  );

  useEffect(() => {
    if (categoryState.success) categoryForm.current?.reset();
  }, [categoryState]);

  useEffect(() => {
    if (itemState.success) itemForm.current?.reset();
  }, [itemState]);

  return (
    <div className={styles.forms}>
      <form
        action={createCategory}
        aria-label="Create category"
        className={styles.form}
        ref={categoryForm}
      >
        <h3>New category</h3>
        <label>
          <span>Name</span>
          <input name="name" maxLength={80} required />
        </label>
        <button disabled={creatingCategory} type="submit">
          {creatingCategory ? "Creating…" : "Create category"}
        </button>
        <FormStatus state={categoryState} />
      </form>

      <form
        action={createItem}
        aria-label="Create library item"
        className={styles.form}
        ref={itemForm}
      >
        <h3>New item</h3>
        {categories.length ? (
          <>
            <label>
              <span>Category</span>
              <select
                name="categoryId"
                required
                defaultValue={categories[0]?.id}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Name</span>
              <input name="name" maxLength={160} required />
            </label>
            <label>
              <span>Description</span>
              <textarea name="description" maxLength={2_000} required />
            </label>
            <label>
              <span>Link</span>
              <input name="link" type="url" maxLength={2_048} required />
            </label>
            <button disabled={creatingItem} type="submit">
              {creatingItem ? "Adding…" : "Add item"}
            </button>
          </>
        ) : (
          <p className={styles.emptyForm}>
            Create a category before adding items.
          </p>
        )}
        <FormStatus state={itemState} />
      </form>
    </div>
  );
}
