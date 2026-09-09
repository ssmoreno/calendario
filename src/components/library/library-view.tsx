"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Button,
  Dialog,
  DialogTrigger,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus";
import { X } from "@phosphor-icons/react/dist/ssr/X";

import {
  createLibraryItemAction,
  type LibraryActionState,
} from "@/app/(app)/library/actions";
import { readingMinutes } from "@/library/reading";
import {
  DEFAULT_LIBRARY_TAGS,
  normalizeLibraryTagName,
  type LibraryItemRecord,
} from "@/library/types";
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

function ItemForm({ availableTags }: { availableTags: string[] }) {
  const form = useRef<HTMLFormElement>(null);
  const [state, createItem, pending] = useActionState(
    createLibraryItemAction,
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.success) form.current?.reset();
  }, [state]);

  const tags = [
    ...new Map(
      [...DEFAULT_LIBRARY_TAGS, ...availableTags].map((tag) => [
        normalizeLibraryTagName(tag),
        tag,
      ]),
    ).values(),
  ];

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
        <span>Link (optional)</span>
        <input
          name="link"
          type="url"
          maxLength={2_048}
          placeholder="https://"
        />
      </label>
      <fieldset className={styles.tagPicker}>
        <legend>Tags</legend>
        <div>
          {tags.map((tag) => (
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

function CreateDialog({ availableTags }: { availableTags: string[] }) {
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
                  Save something worth returning to, with or without a link.
                </p>
                <ItemForm availableTags={availableTags} />
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

export function LibraryControls({ availableTags }: { availableTags: string[] }) {
  return <CreateDialog availableTags={availableTags} />;
}

interface LibraryBrowserProps {
  items: LibraryItemRecord[];
  availableTags: string[];
}

function searchText(item: LibraryItemRecord): string {
  return [item.title, item.description, item.summary, item.link, ...item.tags]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

/**
 * Filtering happens here rather than on the server: the whole library is
 * already in the page, so typing narrows it as you go and a tag lands the
 * moment it is pressed, with no round trip and no Search button.
 */
export function LibraryBrowser({ items, availableTags }: LibraryBrowserProps) {
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const searchable = useMemo(
    () =>
      items.map((item) => ({
        item,
        text: searchText(item),
        tags: item.tags.map(normalizeLibraryTagName),
      })),
    [items],
  );

  const visible = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
    const tags = selectedTags.map(normalizeLibraryTagName);
    if (!terms.length && !tags.length) return items;
    return searchable
      .filter(
        (entry) =>
          terms.every((term) => entry.text.includes(term)) &&
          tags.every((tag) => entry.tags.includes(tag)),
      )
      .map((entry) => entry.item);
  }, [items, searchable, query, selectedTags]);

  const filtering = Boolean(query.trim() || selectedTags.length);
  const itemLabel = items.length === 1 ? "item" : "items";

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((value) => value !== tag)
        : [...current, tag],
    );
  }

  return (
    <>
      <header className={styles.heading}>
        <div className={styles.headingCopy}>
          <p className={styles.eyebrow}>Personal library</p>
          <h2 id="library-heading">Library</h2>
        </div>
        <div className={styles.headingActions}>
          <span className={styles.headingMeta} aria-live="polite">
            {filtering
              ? `${visible.length} of ${items.length} ${itemLabel}`
              : `${items.length} ${itemLabel}`}
          </span>
          <LibraryControls availableTags={availableTags} />
        </div>
      </header>

      {items.length ? (
        <>
          <div className={styles.filters}>
            <label className={styles.searchField}>
              <span className={styles.eyebrow}>Describe what you remember</span>
              <span className={styles.searchInput}>
                <MagnifyingGlass size={17} aria-hidden="true" />
                <input
                  maxLength={160}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="e.g. database guide for type-safe queries"
                  type="search"
                  value={query}
                />
              </span>
            </label>
            {availableTags.length ? (
              <div
                className={styles.filterTags}
                role="group"
                aria-label="Filter by every selected tag"
              >
                <span className={styles.filterTagsLabel}>
                  Filter by every selected tag
                </span>
                <div>
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      aria-pressed={selectedTags.includes(tag)}
                      onClick={() => toggleTag(tag)}
                      type="button"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {filtering ? (
              <div className={styles.filterActions}>
                <button
                  className={styles.clearButton}
                  onClick={() => {
                    setQuery("");
                    setSelectedTags([]);
                  }}
                  type="button"
                >
                  Clear filters
                </button>
              </div>
            ) : null}
          </div>

          {visible.length ? (
            <ul className={styles.items}>
              {visible.map((item) => (
                <li key={item.id}>
                  <Link className={styles.itemLink} href={`/library/${item.id}`}>
                    <span className={styles.itemCopy}>
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                      <span className={styles.itemTags} aria-label="Tags">
                        {item.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </span>
                    </span>
                    <span className={styles.itemMeta}>
                      {item.summary
                        ? `${readingMinutes(item.summary)} min read`
                        : "Read"}
                      <ArrowRight size={13} aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.emptyLibrary}>
              <div>
                <strong>No matching items</strong>
                <span>Try fewer words or remove a tag filter.</span>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptyLibrary}>
          <div>
            <strong>No saved items yet</strong>
            <span>Send SS a link, image, or PDF, or add one manually.</span>
          </div>
        </div>
      )}
    </>
  );
}
