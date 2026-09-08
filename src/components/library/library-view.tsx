"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus";
import { X } from "@phosphor-icons/react/dist/ssr/X";

import {
  createCategoryAction,
  createLibraryItemAction,
  type LibraryActionState,
} from "@/app/(app)/library/actions";
import styles from "./library.module.css";

const INITIAL_STATE: LibraryActionState = {};

interface CategoryOption {
  id: string;
  name: string;
}

function FormStatus({ state }: { state: LibraryActionState }) {
  const message = state.error ?? state.success;
  if (!message) return null;
  return (
    <p
      className={styles.status}
      data-error={Boolean(state.error) || undefined}
      aria-live="polite"
    >
      {message}
    </p>
  );
}

function CategoryForm() {
  const form = useRef<HTMLFormElement>(null);
  const [state, createCategory, pending] = useActionState(
    createCategoryAction,
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.success) form.current?.reset();
  }, [state]);

  return (
    <form
      action={createCategory}
      aria-label="Create category"
      className={styles.form}
      ref={form}
    >
      <label className={styles.field}>
        <span>Name</span>
        <input
          name="name"
          maxLength={80}
          placeholder="e.g. Design references"
          required
        />
      </label>
      <button className={styles.submitButton} disabled={pending} type="submit">
        {pending ? "Creating…" : "Create category"}
      </button>
      <FormStatus state={state} />
    </form>
  );
}

function ItemForm({ categories }: { categories: CategoryOption[] }) {
  const form = useRef<HTMLFormElement>(null);
  const [state, createItem, pending] = useActionState(
    createLibraryItemAction,
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.success) form.current?.reset();
  }, [state]);

  return (
    <form
      action={createItem}
      aria-label="Create library item"
      className={styles.form}
      ref={form}
    >
      <label className={styles.field}>
        <span>Category</span>
        <select name="categoryId" required defaultValue={categories[0]?.id}>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>Name</span>
        <input name="name" maxLength={160} required />
      </label>
      <label className={styles.field}>
        <span>Description</span>
        <textarea name="description" maxLength={2_000} required />
      </label>
      <label className={styles.field}>
        <span>Link</span>
        <input
          name="link"
          type="url"
          maxLength={2_048}
          placeholder="https://"
          required
        />
      </label>
      <button className={styles.submitButton} disabled={pending} type="submit">
        {pending ? "Adding…" : "Add item"}
      </button>
      <FormStatus state={state} />
    </form>
  );
}

function CreateDialog({ categories }: { categories: CategoryOption[] }) {
  const defaultMode = categories.length ? "item" : "category";
  const [mode, setMode] = useState<"item" | "category">(defaultMode);

  return (
    <DialogTrigger
      onOpenChange={(isOpen) => {
        if (isOpen) setMode(defaultMode);
      }}
    >
      <Button className={styles.addButton}>
        <Plus size={15} aria-hidden="true" />
        Add to library
      </Button>
      <ModalOverlay className={styles.modalOverlay} isDismissable>
        <Modal className={styles.modal}>
          <Dialog className={styles.dialog} aria-labelledby="library-dialog-title">
            {({ close }) => (
              <>
                <header className={styles.dialogHeader}>
                  <div>
                    <span className={styles.eyebrow}>Manual entry</span>
                    <h2 id="library-dialog-title">Add to your library</h2>
                  </div>
                  <button
                    className={styles.closeButton}
                    aria-label="Close"
                    type="button"
                    onClick={close}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </header>

                {categories.length ? (
                  <div className={styles.modePicker} aria-label="What to add">
                    <button
                      aria-pressed={mode === "item"}
                      type="button"
                      onClick={() => setMode("item")}
                    >
                      Item
                    </button>
                    <button
                      aria-pressed={mode === "category"}
                      type="button"
                      onClick={() => setMode("category")}
                    >
                      Category
                    </button>
                  </div>
                ) : null}

                <p className={styles.dialogDescription}>
                  {mode === "item"
                    ? "Save a link and a short note for later."
                    : "Create a collection for related links."}
                </p>
                {mode === "item" ? (
                  <ItemForm categories={categories} />
                ) : (
                  <CategoryForm />
                )}
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

export function LibraryControls({
  categories,
}: {
  categories: CategoryOption[];
}) {
  return <CreateDialog categories={categories} />;
}
