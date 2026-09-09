import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";

import { messages } from "@/calendar/messages";
import { LibraryControls } from "@/components/library/library-view";
import { listLibrary } from "@/server/library-store";
import { requireSession } from "@/server/session";

import styles from "@/components/library/library.module.css";

export const metadata: Metadata = {
  title: `${messages.library.title} — ${messages.appName}`,
};

interface LibraryPageProps {
  searchParams: Promise<{
    q?: string | string[];
    tag?: string | string[];
  }>;
}

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 160) ?? "";
}

function tagParams(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [
    ...new Set(values.map((tag) => tag.trim().slice(0, 80)).filter(Boolean)),
  ].slice(0, 8);
}

export default async function Library({ searchParams }: LibraryPageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const query = firstParam(params.q);
  const selectedTags = tagParams(params.tag);
  const { items, availableTags, totalCount } = await listLibrary(
    session.user.id,
    { query, tags: selectedTags },
  );
  const filtering = Boolean(query || selectedTags.length);
  const itemLabel = totalCount === 1 ? "item" : "items";

  return (
    <section className={styles.library} aria-labelledby="library-heading">
      <div className={styles.libraryInner}>
        <header className={styles.heading}>
          <div className={styles.headingCopy}>
            <p className={styles.eyebrow}>Personal library</p>
            <h2 id="library-heading">Library</h2>
          </div>
          <div className={styles.headingActions}>
            <span className={styles.headingMeta}>
              {filtering
                ? `${items.length} of ${totalCount} ${itemLabel}`
                : `${totalCount} ${itemLabel}`}
            </span>
            <LibraryControls />
          </div>
        </header>

        {totalCount ? (
          <>
            <form
              action="/library"
              aria-label="Search library"
              className={styles.filters}
              method="get"
            >
              <label className={styles.searchField}>
                <span className={styles.eyebrow}>Describe what you remember</span>
                <span className={styles.searchInput}>
                  <MagnifyingGlass size={17} aria-hidden="true" />
                  <input
                    defaultValue={query}
                    maxLength={160}
                    name="q"
                    placeholder="e.g. database guide for type-safe queries"
                    type="search"
                  />
                </span>
              </label>
              {availableTags.length ? (
                <fieldset className={styles.filterTags}>
                  <legend>Filter by every selected tag</legend>
                  <div>
                    {availableTags.map((tag) => (
                      <label key={tag}>
                        <input
                          defaultChecked={selectedTags.includes(tag)}
                          name="tag"
                          type="checkbox"
                          value={tag}
                        />
                        <span>{tag}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              <div className={styles.filterActions}>
                <button className={styles.searchButton} type="submit">
                  Search
                </button>
                {filtering ? (
                  <Link className={styles.clearLink} href="/library">
                    Clear filters
                  </Link>
                ) : null}
              </div>
            </form>

            {items.length ? (
              <ul className={styles.items}>
                {items.map((item) => (
                  <li key={item.id}>
                    <a
                      className={styles.itemLink}
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                    >
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
                        Open
                        <ArrowUpRight size={13} aria-hidden="true" />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.emptyLibrary}>
                <div>
                  <strong>No matching links</strong>
                  <span>Try fewer words or remove a tag filter.</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className={styles.emptyLibrary}>
            <div>
              <strong>No saved links yet</strong>
              <span>Send SS a link, or add one manually.</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
