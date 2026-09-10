import { SAVED_ITEM_REACTION } from "@/library/constants";

/** A reply that ticks messages off instead of answering all of them in words. */
export interface Acknowledgement {
  /** Positions in the batch the turn was shown. Empty means every message. */
  positions: number[];
  /** What is left to send as an ordinary message, if anything. */
  reply: string;
}

const DIRECTIVE = new RegExp(`^${SAVED_ITEM_REACTION}[ \\t]*([\\d, \\t]*)$`);

/**
 * The agent asks for reactions by opening its reply with a line of `✅` and the
 * numbers it finished. Anything that does not match exactly is ordinary text,
 * so a message that merely happens to mention a checkmark is still sent as-is.
 */
export function parseAcknowledgement(message: string): Acknowledgement | null {
  const [first = "", ...rest] = message.split("\n");
  const numbers = DIRECTIVE.exec(first.trim())?.[1];
  if (numbers === undefined) return null;

  const positions = numbers
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  return { positions: [...new Set(positions)], reply: rest.join("\n").trim() };
}
