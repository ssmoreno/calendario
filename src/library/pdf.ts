import { extractText, getDocumentProxy } from "unpdf";

import { readResponseBytes } from "@/lib/response-body";

import { assertPublicUrl } from "./public-url";

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_PDF_TEXT_CHARS = 50_000;
const REQUEST_TIMEOUT_MS = 20_000;

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
  const target = await assertPublicUrl(url, ["https:"]);
  const response = await fetch(target, {
    headers: { Accept: "application/pdf" },
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
  });
  if (!response.ok) {
    throw new Error(`PDF request failed with status ${response.status}.`);
  }

  const bytes = await readResponseBytes(response, MAX_PDF_BYTES);
  return extractPdfText(bytes);
}
