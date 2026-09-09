import { defineTool, type ToolContext } from "eve/tools";
import { webFetch } from "eve/tools/defaults";

import { readPdfText } from "../../../../src/library/pdf";

const FALLBACK_TO_SEARCH =
  "Use web_search to find a readable version of this exact document.";
const NO_TEXT_LAYER = `This PDF has no extractable text, so it is probably scanned images. ${FALLBACK_TO_SEARCH}`;
const UNREADABLE_PDF = `This PDF could not be downloaded or decoded. ${FALLBACK_TO_SEARCH}`;

interface WebFetchInput {
  format?: "html" | "markdown" | "text";
  timeout?: number;
  url: string;
}

interface WebFetchResult {
  content: string;
  contentType: string;
  truncated: boolean;
  url: string;
}

function redirectUrl(error: unknown): string | null {
  if (!(error instanceof Error)) return null;

  const match = /^Request redirected to (https:\/\/.+)\. Call web_fetch again with that URL\.$/u.exec(
    error.message,
  );
  return match?.[1] ?? null;
}

async function fetchWithRedirects(
  input: WebFetchInput,
  ctx: ToolContext,
  remainingRedirects = 3,
): Promise<unknown> {
  try {
    return await webFetch.execute(input, ctx);
  } catch (error) {
    const url = redirectUrl(error);
    if (!url || remainingRedirects === 0) throw error;
    return fetchWithRedirects(
      { ...input, url },
      ctx,
      remainingRedirects - 1,
    );
  }
}

function isPdfResult(output: unknown): output is WebFetchResult {
  if (!output || typeof output !== "object") {
    return false;
  }

  const result = output as Partial<WebFetchResult>;

  return (
    typeof result.content === "string" &&
    typeof result.contentType === "string" &&
    typeof result.truncated === "boolean" &&
    typeof result.url === "string" &&
    (result.contentType.toLowerCase().includes("application/pdf") ||
      result.content.trimStart().startsWith("%PDF-"))
  );
}

/** The fetched body is binary, so the PDF is downloaded again and read as text. */
async function pdfResult(
  result: WebFetchResult,
  ctx: ToolContext,
): Promise<WebFetchResult> {
  try {
    const { text, truncated } = await readPdfText(result.url, ctx.abortSignal);
    return { ...result, content: text || NO_TEXT_LAYER, truncated };
  } catch (error) {
    if (ctx.abortSignal.aborted) throw error;
    return { ...result, content: UNREADABLE_PDF, truncated: false };
  }
}

export default defineTool({
  ...webFetch,
  description: `${webFetch.description}\n- Up to three safe HTTPS redirects are followed automatically\n- A PDF body is returned as its extracted text`,
  async execute(input, ctx) {
    const output = await fetchWithRedirects(input as WebFetchInput, ctx);
    return isPdfResult(output) ? pdfResult(output, ctx) : output;
  },
});
