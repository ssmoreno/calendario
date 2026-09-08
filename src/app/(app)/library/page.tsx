import type { Metadata } from "next";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";

import { messages } from "@/calendar/messages";
import { LibraryControls } from "@/components/library/library-view";
import { listLibrary } from "@/server/library-store";
import { requireSession } from "@/server/session";

import styles from "@/components/library/library.module.css";

export const metadata: Metadata = {
  title: `${messages.library.title} — ${messages.appName}`,
};

export default async function Library() {
  const session = await requireSession();
  const categories = await listLibrary(session.user.id);
  const itemCount = categories.reduce(
    (count, category) => count + category.items.length,
    0,
  );

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
              {`${categories.length} ${categories.length === 1 ? "category" : "categories"} · ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
            </span>
            <LibraryControls
              categories={categories.map(({ id, name }) => ({ id, name }))}
            />
          </div>
        </header>

        {categories.length ? (
          <div className={styles.categories}>
            {categories.map((category) => (
              <section
                className={styles.category}
                aria-labelledby={`category-${category.id}`}
                key={category.id}
              >
                <header>
                  <h3 id={`category-${category.id}`}>{category.name}</h3>
                  <span className={styles.categoryCount}>
                    {`${category.items.length} ${category.items.length === 1 ? "item" : "items"}`}
                  </span>
                </header>
                {category.items.length ? (
                  <ul>
                    {category.items.map((item) => (
                      <li key={item.id}>
                        <a
                          className={styles.itemLink}
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span className={styles.itemCopy}>
                            <strong>{item.name}</strong>
                            <span>{item.description}</span>
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
                  <p className={styles.emptyCategory}>No saved items yet.</p>
                )}
              </section>
            ))}
          </div>
        ) : (
          <div className={styles.emptyLibrary}>
            <div>
              <strong>No collections yet</strong>
              <span>
                Ask SS to save something here, or add your first category manually.
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
