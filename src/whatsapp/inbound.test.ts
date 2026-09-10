import { Buffer } from "node:buffer";
import type { Attachment } from "chat";
import { describe, expect, it, vi } from "vitest";

import { inboundMessagePreview, whatsAppMessageContent } from "./inbound";

function message(text: string, attachments: Attachment[] = []) {
  return { attachments, text };
}

describe("whatsAppMessageContent", () => {
  it("keeps ordinary text messages as text", async () => {
    await expect(whatsAppMessageContent(message("  hello  "))).resolves.toBe(
      "hello",
    );
  });

  it("downloads an authenticated image attachment for the model", async () => {
    const fetchData = vi.fn().mockResolvedValue(Buffer.from("image bytes"));

    const content = await whatsAppMessageContent(
      message("Save this", [
        {
          type: "image",
          mimeType: "image/jpeg",
          name: "cover.jpg",
          fetchData,
        },
      ]),
    );

    expect(fetchData).toHaveBeenCalledOnce();
    expect(content).toEqual([
      { type: "text", text: "Save this" },
      expect.objectContaining({
        type: "file",
        mediaType: "image/jpeg",
        filename: "cover.jpg",
        data: expect.any(Uint8Array),
      }),
    ]);
  });

  it("accepts a PDF attachment without accompanying text", async () => {
    await expect(
      whatsAppMessageContent(
        message("", [
          {
            type: "file",
            mimeType: "application/pdf",
            name: "report.pdf",
            url: "https://media.example/report.pdf",
          },
        ]),
      ),
    ).resolves.toEqual([
      {
        type: "file",
        data: new URL("https://media.example/report.pdf"),
        mediaType: "application/pdf",
        filename: "report.pdf",
      },
    ]);
  });

  it("rejects an unsupported attachment-only message", async () => {
    await expect(
      whatsAppMessageContent(
        message("", [{ type: "audio", mimeType: "audio/ogg" }]),
      ),
    ).resolves.toBeNull();
  });
});

describe("inboundMessagePreview", () => {
  it("collapses a message onto one line", () => {
    expect(inboundMessagePreview(message(" Artaud\n  el disco "))).toBe(
      "Artaud el disco",
    );
  });

  it("truncates a long message", () => {
    const preview = inboundMessagePreview(message("a".repeat(200)));

    expect(preview).toHaveLength(80);
    expect(preview.endsWith("…")).toBe(true);
  });

  it("names the attachments of a message with no text", () => {
    expect(
      inboundMessagePreview(
        message("", [{ type: "image" }, { type: "image" }, { type: "file" }]),
      ),
    ).toBe("(image, file)");
  });
});
