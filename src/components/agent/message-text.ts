import type { EveMessage } from "eve/react";

/**
 * The transcript renders plain text, so markdown the model slipped in would
 * otherwise reach the user as literal asterisks. Only paired emphasis markers
 * are removed, and only from what the agent wrote: what the user typed is
 * shown back exactly as they typed it.
 */
function withoutEmphasis(text: string): string {
  return text
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/__([\s\S]+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

/**
 * What one message shows. An assistant turn is its last text: anything before
 * that is the agent narrating work it has not finished yet, kept only as the
 * fallback for a turn whose final model call produced nothing.
 */
export function messageText(message: EveMessage): string {
  const texts = message.parts.flatMap((part) =>
    part.type === "text" && part.text.trim() ? [part.text.trim()] : [],
  );
  if (message.role === "user") return texts.join("\n");
  return withoutEmphasis(texts.at(-1) ?? "");
}
