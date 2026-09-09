import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

import { extractText, getDocumentProxy } from "unpdf";

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_PDF_TEXT_CHARS = 50_000;
const REQUEST_TIMEOUT_MS = 20_000;

/** Loopback, private, and reserved ranges, mirroring the guard web_fetch applies. */
const blockedRanges = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedRanges.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
  ["::", 96],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blockedRanges.addSubnet(address, prefix, "ipv6");
}
blockedRanges.addAddress("::1", "ipv6");

export function isPublicIpAddress(address: string): boolean {
  const bare = address.replace(/^\[(.*)\]$/u, "$1").split("%")[0]!;
  const mapped = bare.toLowerCase().startsWith("::ffff:") ? bare.slice(7) : bare;
  const normalized = isIP(mapped) === 4 ? mapped : bare;
  const family = isIP(normalized);

  return family !== 0 && !blockedRanges.check(normalized, family === 4 ? "ipv4" : "ipv6");
}

async function assertPublicHttpsUrl(url: string): Promise<URL> {
  const target = new URL(url);
  if (target.protocol !== "https:") {
    throw new Error("PDF URL must start with https://");
  }

  const host = target.hostname.replace(/^\[(.*)\]$/u, "$1");
  const addresses =
    isIP(host) === 0
      ? (await lookup(host, { all: true })).map(({ address }) => address)
      : [host];
  if (addresses.length === 0 || !addresses.every(isPublicIpAddress)) {
    throw new Error("PDF URL must not target a private or reserved address.");
  }

  return target;
}

export async function extractPdfText(
  bytes: Uint8Array,
): Promise<{ text: string; truncated: boolean }> {
  const document = await getDocumentProxy(bytes);
  const { text } = await extractText(document, { mergePages: true });
  const cleaned = text
    .replace(/[^\S\n]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();

  return {
    text: cleaned.slice(0, MAX_PDF_TEXT_CHARS),
    truncated: cleaned.length > MAX_PDF_TEXT_CHARS,
  };
}

/** Downloads a PDF and returns its text layer, empty when the document has none. */
export async function readPdfText(
  url: string,
  signal: AbortSignal,
): Promise<{ text: string; truncated: boolean }> {
  const target = await assertPublicHttpsUrl(url);
  const response = await fetch(target, {
    headers: { Accept: "application/pdf" },
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
  });
  if (!response.ok) {
    throw new Error(`PDF request failed with status ${response.status}.`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new Error("PDF is too large to read.");
  }

  return extractPdfText(bytes);
}
