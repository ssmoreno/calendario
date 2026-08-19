import type { EveMessage } from "eve/react";

/**
 * The reply, which is the last text a turn produced. Anything before it is the
 * agent narrating work it has not finished yet — kept only as the fallback for
 * a turn whose final model call left nothing behind, so a bubble is never empty.
 */
export function replyText(message: EveMessage): string {
  const texts = message.parts.flatMap((part) =>
    part.type === "text" && part.text.trim() ? [part.text.trim()] : [],
  );
  return texts.at(-1) ?? "";
}

/**
 * The transcript renders replies as plain text, so markdown the model slipped
 * in would otherwise reach the user as literal asterisks. Only paired emphasis
 * markers are removed; anything else the model wrote stays as it wrote it.
 */
export function plainText(text: string): string {
  return text
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/__([\s\S]+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}
