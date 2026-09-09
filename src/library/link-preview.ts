import { assertPublicUrl } from "./public-url";

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 4 * 1024 * 1024;
/** Preview tags live in the head, so a partial read of a long page is enough. */
const MAX_HTML_CHARS = 400_000;
const MAX_REDIRECTS = 3;
const PREVIEW_MAX_AGE_SECONDS = 60 * 60 * 24;
const MAX_TITLE_CHARS = 160;
const MAX_DESCRIPTION_CHARS = 280;
const YOUTUBE_VIDEO_ID = /^[\w-]{11}$/u;

const ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

export interface LinkPreview {
  title: string | null;
  description: string | null;
  image: string | null;
  icon: string | null;
  siteName: string | null;
}

function youtubeVideoId(link: string): string | null {
  try {
    const url = new URL(link);
    const host = url.hostname.toLowerCase();
    let id: string | null = null;

    if (host === "youtu.be" || host === "www.youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtube-nocookie.com" ||
      host.endsWith(".youtube-nocookie.com")
    ) {
      const [kind, pathId] = url.pathname.split("/").filter(Boolean);
      if (kind === "watch") id = url.searchParams.get("v");
      if (["embed", "live", "shorts", "v"].includes(kind ?? "")) {
        id = pathId ?? null;
      }
    }

    return id && YOUTUBE_VIDEO_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

function knownProviderPreview(link: string): LinkPreview | null {
  const videoId = youtubeVideoId(link);
  if (!videoId) return null;

  return {
    title: null,
    description: null,
    image: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    icon: "https://www.youtube.com/favicon.ico",
    siteName: "YouTube",
  };
}

function fillPreview(
  preview: LinkPreview,
  fallback: LinkPreview | null,
): LinkPreview {
  if (!fallback) return preview;

  return {
    title: preview.title ?? fallback.title,
    description: preview.description ?? fallback.description,
    image: preview.image ?? fallback.image,
    icon: preview.icon ?? fallback.icon,
    siteName: preview.siteName ?? fallback.siteName,
  };
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (entity, body: string) => {
    const name = body.toLowerCase();
    if (!name.startsWith("#")) return ENTITIES[name] ?? entity;

    const code = name.startsWith("#x")
      ? Number.parseInt(name.slice(2), 16)
      : Number(name.slice(1));
    return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}

function clean(value: string | null | undefined, limit: number): string | null {
  if (!value) return null;
  const text = decodeEntities(value).replace(/\s+/gu, " ").trim();
  if (!text) return null;
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

function attributes(tag: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const [, name, quoted, single, bare] of tag.matchAll(
    /([a-z][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/giu,
  )) {
    found[name!.toLowerCase()] = quoted ?? single ?? bare ?? "";
  }
  return found;
}

/** Turns a relative or protocol-relative asset into an absolute http(s) URL the browser can load. */
function absoluteUrl(value: string | null, pageUrl: string): string | null {
  if (!value) return null;
  try {
    const resolved = new URL(value, pageUrl);
    return resolved.protocol === "http:" || resolved.protocol === "https:"
      ? resolved.href
      : null;
  } catch {
    return null;
  }
}

export function parseLinkPreview(html: string, pageUrl: string): LinkPreview {
  const head = html.split(/<\/head\s*>/iu)[0] ?? html;
  const provider = knownProviderPreview(pageUrl);

  const meta = new Map<string, string>();
  for (const [tag] of head.matchAll(/<meta\b[^>]*>/giu)) {
    const { property, name, content } = attributes(tag);
    const key = (property ?? name)?.toLowerCase();
    if (key && content && !meta.has(key)) meta.set(key, content);
  }

  let icon: string | null = null;
  for (const [tag] of head.matchAll(/<link\b[^>]*>/giu)) {
    const { rel, href } = attributes(tag);
    if (!icon && href && rel?.toLowerCase().split(/\s+/u).includes("icon")) {
      icon = href;
    }
  }

  const first = (...keys: string[]) => keys.map((key) => meta.get(key)).find(Boolean);
  const documentTitle = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/iu.exec(head)?.[1];

  return fillPreview(
    {
      title:
        clean(first("og:title", "twitter:title"), MAX_TITLE_CHARS) ??
        clean(documentTitle, MAX_TITLE_CHARS),
      description: clean(
        first("og:description", "twitter:description", "description"),
        MAX_DESCRIPTION_CHARS,
      ),
      image: absoluteUrl(
        clean(
          first(
            "og:image",
            "og:image:url",
            "og:image:secure_url",
            "twitter:image",
            "twitter:image:src",
          ),
          2_048,
        ),
        pageUrl,
      ),
      icon: absoluteUrl(
        clean(icon, 2_048) ?? provider?.icon ?? "/favicon.ico",
        pageUrl,
      ),
      siteName: clean(first("og:site_name"), 80),
    },
    provider,
  );
}

/** Follows redirects by hand so every hop is checked against the private address guard. */
async function fetchPage(url: string, hops = MAX_REDIRECTS): Promise<Response | null> {
  const target = await assertPublicUrl(url, ["http:", "https:"]);
  const response = await fetch(target, {
    headers: { Accept: "text/html,application/xhtml+xml" },
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    next: { revalidate: PREVIEW_MAX_AGE_SECONDS },
  });

  const location = response.headers.get("location");
  if (response.status >= 300 && response.status < 400 && location) {
    await response.body?.cancel();
    return hops === 0 ? null : fetchPage(new URL(location, target).href, hops - 1);
  }

  return response;
}

/** Reads the source page's own preview tags. Returns null whenever the page will not give them up. */
export async function fetchLinkPreview(link: string): Promise<LinkPreview | null> {
  const fallback = knownProviderPreview(link);

  try {
    const response = await fetchPage(link);
    if (!response) return fallback;

    const contentType = response.headers.get("content-type") ?? "";
    const length = Number(response.headers.get("content-length") ?? 0);
    if (
      !response.ok ||
      !contentType.toLowerCase().includes("html") ||
      length > MAX_HTML_BYTES
    ) {
      await response.body?.cancel();
      return fallback;
    }

    const html = (await response.text()).slice(0, MAX_HTML_CHARS);
    return fillPreview(parseLinkPreview(html, response.url || link), fallback);
  } catch {
    return fallback;
  }
}
