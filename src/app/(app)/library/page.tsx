import type { Metadata } from "next";

import { messages } from "@/calendar/messages";
import { LibraryForms } from "@/components/library/library-view";
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
      <header className={styles.heading}>
        <div>
          <p>Personal library</p>
          <h2 id="library-heading">Your categories</h2>
        </div>
        <span>{itemCount === 1 ? "1 item" : `${itemCount} items`}</span>
      </header>

      <LibraryForms
        categories={categories.map(({ id, name }) => ({ id, name }))}
      />

      <div className={styles.categories}>
        {categories.length ? (
          categories.map((category) => (
            <section className={styles.category} key={category.id}>
              <header>
                <h3>{category.name}</h3>
                <span>{category.items.length}</span>
              </header>
              {category.items.length ? (
                <ul>
                  {category.items.map((item) => (
                    <li key={item.id}>
                      <a href={item.link} target="_blank" rel="noreferrer">
                        <strong>{item.name}</strong>
                        <span>{item.description}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.emptyCategory}>No items yet.</p>
              )}
            </section>
          ))
        ) : (
          <p className={styles.emptyLibrary}>No categories yet.</p>
        )}
      </div>
    </section>
  );
}
