import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const REQUEST_TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 256 * 1024;

export interface LinkMetadata {
  title: string | null;
  summary: string | null;
}

export type LookupHost = (hostname: string) => Promise<string[]>;

export interface FetchLinkMetadataOptions {
  fetch?: typeof fetch;
  lookupHost?: LookupHost;
}

const EMPTY: LinkMetadata = { title: null, summary: null };

async function resolveHost(hostname: string): Promise<string[]> {
  const addresses = await lookup(hostname, { all: true });
  return addresses.map(({ address }) => address);
}

function ipv4IsPublic(address: string): boolean {
  const [a, b] = address.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a >= 224) return false;
  return true;
}

function ipv6IsPublic(address: string): boolean {
  const value = address.toLowerCase().split("%")[0];
  if (value === "::1" || value === "::") return false;
  // IPv4-mapped and IPv4-compatible forms carry an embedded v4 address.
  const mapped = /^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/.exec(value);
  if (mapped) return ipv4IsPublic(mapped[1]);
  const head = Number.parseInt(value.split(":")[0] || "0", 16);
  if ((head & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((head & 0xffc0) === 0xfe80) return false; // fe80::/10 link local
  return true;
}

function addressIsPublic(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return ipv4IsPublic(address);
  if (family === 6) return ipv6IsPublic(address);
  return false;
}

/**
 * The user controls this URL, so the fetch must not become a way to probe the
 * private network. Literal addresses are checked directly and hostnames are
 * resolved first, because a public name can point at a private address.
 *
 * This does not defend against a name that changes its answer between this
 * lookup and the request itself; closing that needs address pinning at the
 * socket, which is more machinery than a title fetch warrants.
 */
async function assertPublicUrl(
  url: URL,
  lookupHost: LookupHost,
): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https links can be read.");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname)) {
    if (!addressIsPublic(hostname)) throw new Error("That address is not public.");
    return;
  }
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal")
  ) {
    throw new Error("That host is not public.");
  }
  const addresses = await lookupHost(hostname);
  if (addresses.length === 0 || !addresses.every(addressIsPublic)) {
    throw new Error("That host is not public.");
  }
}

/** Reads at most the first {@link MAX_BODY_BYTES}; a page's head is all we need. */
async function readCappedText(response: Response): Promise<string> {
  const body = response.body;
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(buffer.subarray(0, MAX_BODY_BYTES));
}

function decodeEntities(value: string): string {
  return value
    .replace(/&(#\d+|#x[0-9a-f]+);/gi, (whole, code: string) => {
      const point = code.startsWith("#x") || code.startsWith("#X")
        ? Number.parseInt(code.slice(2), 16)
        : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : whole;
    })
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

function clean(value: string | undefined): string | null {
  if (!value) return null;
  const text = decodeEntities(value).replace(/\s+/g, " ").trim();
  return text.length > 0 ? text.slice(0, 500) : null;
}

function metaContent(html: string, property: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)\\s*=\\s*["']${property}["'][^>]*>`,
    "i",
  );
  const tag = pattern.exec(html)?.[0];
  if (!tag) return null;
  return clean(/content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]);
}

export function parseLinkMetadata(html: string): LinkMetadata {
  return {
    title:
      metaContent(html, "og:title") ??
      metaContent(html, "twitter:title") ??
      clean(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]),
    summary:
      metaContent(html, "og:description") ??
      metaContent(html, "description") ??
      metaContent(html, "twitter:description"),
  };
}

async function readLinkPage(
  startUrl: string,
  { fetch: fetcher, lookupHost }: Required<FetchLinkMetadataOptions>,
): Promise<LinkMetadata> {
  let url = new URL(startUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicUrl(url, lookupHost);
    const response = await fetcher(url, {
      headers: { accept: "text/html,application/xhtml+xml" },
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => {});
      if (!location) return EMPTY;
      // Every hop is re-checked: a public URL can redirect to a private one.
      url = new URL(location, url);
      continue;
    }

    if (!response.ok) return EMPTY;
    if (!(response.headers.get("content-type") ?? "").includes("text/html")) {
      await response.body?.cancel().catch(() => {});
      return EMPTY;
    }
    return parseLinkMetadata(await readCappedText(response));
  }
  return EMPTY;
}

/**
 * Best-effort title and description for a link the user sent. Never throws:
 * a page that is unreachable, private, oversized, or not HTML still saves,
 * just without a title.
 */
export async function fetchLinkMetadata(
  url: string,
  options: FetchLinkMetadataOptions = {},
): Promise<LinkMetadata> {
  try {
    return await readLinkPage(url, {
      fetch: options.fetch ?? fetch,
      lookupHost: options.lookupHost ?? resolveHost,
    });
  } catch {
    return EMPTY;
  }
}
