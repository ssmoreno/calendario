import type { FilePart, UserContent } from "ai";
import type { Attachment, Message } from "chat";

const IMAGE_MAX_BYTES = 3 * 1024 * 1024;
const PDF_MAX_BYTES = 20 * 1024 * 1024;

function attachmentMediaType(attachment: Attachment): string | null {
  const declared = attachment.mimeType?.split(";", 1)[0]?.trim().toLowerCase();
  if (declared?.startsWith("image/") || declared === "application/pdf") {
    return declared;
  }
  if (attachment.type === "image") return "image/jpeg";
  if (attachment.name?.toLowerCase().endsWith(".pdf")) {
    return "application/pdf";
  }
  return null;
}

function maximumBytes(mediaType: string): number {
  return mediaType.startsWith("image/") ? IMAGE_MAX_BYTES : PDF_MAX_BYTES;
}

function byteLength(data: FilePart["data"]): number | null {
  if (data instanceof Uint8Array) return data.byteLength;
  if (data instanceof ArrayBuffer) return data.byteLength;
  return null;
}

async function attachmentData(
  attachment: Attachment,
): Promise<FilePart["data"] | null> {
  if (attachment.data instanceof Blob) {
    return new Uint8Array(await attachment.data.arrayBuffer());
  }
  if (attachment.data) return new Uint8Array(attachment.data);

  if (attachment.fetchData) {
    try {
      const data = await attachment.fetchData();
      return new Uint8Array(data);
    } catch {
      // A signed media URL may still work when the authenticated download fails.
    }
  }

  if (!attachment.url) return null;
  try {
    return new URL(attachment.url);
  } catch {
    return null;
  }
}

async function attachmentPart(
  attachment: Attachment,
): Promise<FilePart | null> {
  const mediaType = attachmentMediaType(attachment);
  if (!mediaType || (attachment.size ?? 0) > maximumBytes(mediaType)) {
    return null;
  }

  const data = await attachmentData(attachment);
  const size = data ? byteLength(data) : null;
  if (!data || (size !== null && size > maximumBytes(mediaType))) return null;

  return {
    type: "file",
    data,
    mediaType,
    filename: attachment.name,
  };
}

export async function whatsAppMessageContent(
  message: Pick<Message, "attachments" | "text">,
): Promise<UserContent | null> {
  const text = message.text.trim();
  const attachments = (
    await Promise.all(message.attachments.map(attachmentPart))
  ).filter((part): part is FilePart => part !== null);

  if (!attachments.length) return text || null;
  return [...(text ? [{ type: "text" as const, text }] : []), ...attachments];
}
