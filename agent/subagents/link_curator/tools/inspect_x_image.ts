import { Buffer } from "node:buffer";
import { defineTool, toolOutput, toolOutputPart } from "eve/tools";
import { z } from "zod";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const inputSchema = z.object({
  url: z
    .string()
    .url()
    .refine((value) => {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname === "pbs.twimg.com";
    }, "Use an https://pbs.twimg.com image URL from the exact X post."),
});

export default defineTool({
  description:
    "Inspect an image attached to the exact X post being curated. Only accepts trusted pbs.twimg.com media URLs returned by fetch or search.",
  inputSchema,
  async execute({ url }, ctx) {
    const response = await fetch(url, {
      headers: { Accept: "image/*" },
      redirect: "error",
      signal: AbortSignal.any([ctx.abortSignal, AbortSignal.timeout(15_000)]),
    });
    if (!response.ok) {
      throw new Error(`Image request failed with status ${response.status}.`);
    }

    const mediaType = response.headers.get("content-type")?.split(";", 1)[0];
    if (!mediaType?.startsWith("image/")) {
      throw new Error("The X media URL did not return an image.");
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new Error("The X image is too large to inspect.");
    }

    return { base64: bytes.toString("base64"), mediaType, url };
  },
  toModelOutput(output) {
    return toolOutput.content([
      toolOutputPart.text(`Attached image from ${output.url}:`),
      toolOutputPart.file(output.base64, { mediaType: output.mediaType }),
    ]);
  },
});
