import type { Metadata } from "next";

import { messages } from "@/calendar/messages";
import { LibraryBrowser } from "@/components/library/library-view";
import { listLibrary } from "@/server/library-store";
import { requireSession } from "@/server/session";

import styles from "@/components/library/library.module.css";

export const metadata: Metadata = {
  title: `${messages.library.title} — ${messages.appName}`,
};

export default async function Library() {
  const session = await requireSession();
  const { items, availableTags } = await listLibrary(session.user.id);

  return (
    <section className={styles.library} aria-labelledby="library-heading">
      <div className={styles.libraryInner}>
        <LibraryBrowser items={items} availableTags={availableTags} />
      </div>
    </section>
  );
}
