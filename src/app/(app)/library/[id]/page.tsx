import type { Metadata } from "next";
import { cache, Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";

import { messages } from "@/calendar/messages";
import {
  LinkCardFallback,
  LinkPreviewCard,
} from "@/components/library/link-card";
import {
  isLongLibraryNote,
  readingMinutes,
  readingParagraphs,
  sourceHost,
} from "@/library/reading";
import { storeLinkFor } from "@/library/store-link";
import type { LibraryItemRecord } from "@/library/types";
import { findLibraryItem } from "@/server/library-store";
import { requireSession } from "@/server/session";

import styles from "@/components/library/reading.module.css";

interface ReadingPageProps {
  params: Promise<{ id: string }>;
}

/* The metadata and the page both need the item; cache keeps it to one query. */
const loadItem = cache(async (id: string): Promise<LibraryItemRecord> => {
  const session = await requireSession();
  const item = await findLibraryItem(session.user.id, id);
  if (!item) notFound();
  return item;
});

const savedOn = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export async function generateMetadata({
  params,
}: ReadingPageProps): Promise<Metadata> {
  const { id } = await params;
  const item = await loadItem(id);
  return {
    title: `${item.title} — ${messages.appName}`,
    description: item.description,
  };
}

export default async function Reading({ params }: ReadingPageProps) {
  const { id } = await params;
  const item = await loadItem(id);
  const body = item.note ? readingParagraphs(item.note) : [];
  const isLongRead = item.note ? isLongLibraryNote(item.note) : false;
  const host = item.link ? sourceHost(item.link) : null;
  const store = item.link ? storeLinkFor(item.link) : null;

  return (
    <article className={styles.reading} aria-labelledby="reading-title">
      <div
        className={styles.readingInner}
        data-with-preview={item.link ? true : undefined}
      >
        <nav className={styles.topBar} aria-label="Reading">
          <Link className={styles.back} href="/library">
            <ArrowLeft size={14} aria-hidden="true" />
            {messages.views.library}
          </Link>
          {item.link && host ? (
            <a
              className={styles.sourceLink}
              href={item.link}
              target="_blank"
              rel="noreferrer"
            >
              {host}
              <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          ) : null}
        </nav>

        <div
          className={styles.hero}
          data-with-preview={item.link ? true : undefined}
        >
          <header className={styles.header}>
            <p className={styles.eyebrow}>
              <span>{host ?? "Saved item"}</span>
              <span aria-hidden="true">·</span>
              <span>{savedOn.format(new Date(item.createdAt))}</span>
              {item.note ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {isLongRead
                      ? `${readingMinutes(item.note)} min read`
                      : "Note"}
                  </span>
                </>
              ) : null}
            </p>
            <h1 id="reading-title">{item.title}</h1>
            <p className={styles.lede}>{item.description}</p>
            {item.tags.length ? (
              <p className={styles.tags} aria-label="Tags">
                {item.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </p>
            ) : null}
          </header>

          {item.link ? (
            <aside
              className={styles.preview}
              aria-label={store ? "Where to find it" : "Original source"}
            >
              <Suspense
                fallback={<LinkCardFallback link={item.link} title={item.title} />}
              >
                <LinkPreviewCard link={item.link} title={item.title} />
              </Suspense>
            </aside>
          ) : null}
        </div>

        {body.length ? (
          <div className={styles.body} data-long-read={isLongRead || undefined}>
            {body.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ) : (
          <p className={styles.noRead}>
            {item.link
              ? `This one was saved without a note. ${store?.name ?? "The original"} is a tap away.`
              : "This item was saved without a note."}
          </p>
        )}
      </div>
    </article>
  );
}
