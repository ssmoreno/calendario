/** A book or album has no page of its own worth saving, so it links to where the work lives. */
export interface LibraryStore {
  /** The content tag an item must carry for this store to fit it. */
  tag: string;
  name: string;
  cta: string;
  host: RegExp;
}

const STORES: LibraryStore[] = [
  {
    tag: "Book",
    name: "Amazon",
    cta: "Find it on Amazon",
    host: /^(?:[a-z0-9-]+\.)*amazon\.[a-z]{2,3}(?:\.[a-z]{2})?$/u,
  },
  {
    tag: "Music",
    name: "Spotify",
    cta: "Listen on Spotify",
    host: /^open\.spotify\.com$/u,
  },
];

export function storeLinkFor(link: string): LibraryStore | null {
  try {
    const host = new URL(link).hostname.toLowerCase();
    return STORES.find((store) => store.host.test(host)) ?? null;
  } catch {
    return null;
  }
}
