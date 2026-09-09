import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import { GlobeSimple } from "@phosphor-icons/react/dist/ssr/GlobeSimple";

import { fetchLinkPreview, type LinkPreview } from "@/library/link-preview";
import { sourceHost } from "@/library/reading";
import { storeLinkFor } from "@/library/store-link";

import styles from "./link-card.module.css";

interface LinkCardProps {
  link: string;
  title: string;
}

function Card({
  link,
  title,
  preview,
  pending = false,
}: LinkCardProps & { preview: LinkPreview | null; pending?: boolean }) {
  const host = sourceHost(link);
  const store = storeLinkFor(link);

  return (
    <a className={styles.card} href={link} target="_blank" rel="noreferrer">
      <span className={styles.frame} data-pending={pending || undefined}>
        {preview?.image ? (
          /* eslint-disable-next-line @next/next/no-img-element -- previews come from
             arbitrary hosts, which the image optimizer would have to be opened up to. */
          <img
            className={styles.image}
            src={preview.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className={styles.monogram} aria-hidden="true">
            {host.slice(0, 1).toUpperCase()}
          </span>
        )}
      </span>
      <span className={styles.body}>
        <span className={styles.source}>
          <span className={styles.mark} aria-hidden="true">
            {preview?.icon ? (
              /* eslint-disable-next-line @next/next/no-img-element -- see above. */
              <img src={preview.icon} alt="" loading="lazy" referrerPolicy="no-referrer" />
            ) : (
              <GlobeSimple size={12} />
            )}
          </span>
          {preview?.siteName ?? host}
        </span>
        <strong className={styles.title}>{preview?.title ?? title}</strong>
        {preview?.description ? (
          <span className={styles.description}>{preview.description}</span>
        ) : null}
        <span className={styles.cta}>
          {store ? store.cta : "Read the original"}
          <ArrowUpRight size={14} aria-hidden="true" />
        </span>
      </span>
    </a>
  );
}

/** Shown while the source page is being read, so the link is clickable from the first paint. */
export function LinkCardFallback(props: LinkCardProps) {
  return <Card {...props} preview={null} pending />;
}

export async function LinkPreviewCard(props: LinkCardProps) {
  return <Card {...props} preview={await fetchLinkPreview(props.link)} />;
}
