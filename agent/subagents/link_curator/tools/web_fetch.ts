import { defineTool, toolOutput, type ToolContext } from "eve/tools";
import { webFetch } from "eve/tools/defaults";

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

export default defineTool({
  ...webFetch,
  description: `${webFetch.description}\n- Up to three safe HTTPS redirects are followed automatically\n- Binary PDF bodies are omitted from model output; use web_search to find a matching readable version`,
  execute(input, ctx) {
    return fetchWithRedirects(input as WebFetchInput, ctx);
  },
  toModelOutput(output) {
    if (!isPdfResult(output)) {
      return toolOutput.json(output);
    }

    return toolOutput.json({
      content:
        "PDF body omitted because it is binary. Use web_search to find this exact document's official HTML abstract, transcript, or accessible full-text copy, then fetch that page.",
      contentType: output.contentType,
      truncated: true,
      url: output.url,
    });
  },
});
