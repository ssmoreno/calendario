"use client";

import { useActionState, useEffect, useRef } from "react";
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
  createLibraryItemAction,
  type LibraryActionState,
} from "@/app/(app)/library/actions";
import { LIBRARY_TAGS } from "@/library/types";
import styles from "./library.module.css";

const INITIAL_STATE: LibraryActionState = {};

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

function ItemForm() {
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
        <span>Title</span>
        <input name="title" maxLength={160} required />
      </label>
      <label className={styles.field}>
        <span>Description</span>
        <textarea
          name="description"
          maxLength={240}
          placeholder="One short line about what this is."
          required
        />
      </label>
      <label className={styles.field}>
        <span>The read (optional)</span>
        <textarea
          className={styles.readField}
          name="summary"
          maxLength={2_600}
          placeholder="About one book page, in your own words."
        />
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
      <fieldset className={styles.tagPicker}>
        <legend>Tags</legend>
        <div>
          {LIBRARY_TAGS.map((tag) => (
            <label key={tag}>
              <input name="tags" type="checkbox" value={tag} />
              <span>{tag}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button className={styles.submitButton} disabled={pending} type="submit">
        {pending ? "Adding…" : "Add item"}
      </button>
      <FormStatus state={state} />
    </form>
  );
}

function CreateDialog() {
  return (
    <DialogTrigger>
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
                <p className={styles.dialogDescription}>
                  Save a link with a short description and broad tags.
                </p>
                <ItemForm />
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

export function LibraryControls() {
  return <CreateDialog />;
}
