import type { Thread } from "chat";

import { SAVED_ITEM_REACTION } from "@/library/constants";
import {
  clearShownInboundMessages,
  shownInboundBatch,
  type InboundMessage,
} from "@/server/whatsapp-inbound-store";

import { parseAcknowledgement } from "./acknowledgement";

export { SAVED_ITEM_REACTION } from "@/library/constants";

interface CompletedMessage {
  finishReason: string;
  message?: string | null;
}

async function post(thread: Thread, message: string) {
  await thread.post({ markdown: message });
}

async function react(thread: Thread, messageId: string): Promise<boolean> {
  try {
    await thread.adapter.addReaction(thread.id, messageId, SAVED_ITEM_REACTION);
    return true;
  } catch {
    return false;
  }
}

/** The messages the reply ticked, ignoring numbers no longer in the batch. */
function ticked(
  batch: InboundMessage[],
  positions: number[],
): InboundMessage[] {
  if (!positions.length) return batch;
  return positions.flatMap((position) => batch[position - 1] ?? []);
}

export async function deliverWhatsAppMessage(
  event: CompletedMessage,
  thread: Thread | null,
): Promise<void> {
  if (event.finishReason === "tool-calls" || !event.message || !thread) return;

  const acknowledgement = parseAcknowledgement(event.message);
  if (!acknowledgement) {
    await post(thread, event.message);
    await clearShownInboundMessages(thread.id);
    return;
  }

  const batch = await shownInboundBatch(thread.id);
  const reacted = await Promise.all(
    ticked(batch, acknowledgement.positions).map((message) =>
      react(thread, message.messageId),
    ),
  );
  if (acknowledgement.reply) {
    await post(thread, acknowledgement.reply);
  } else if (!reacted.some(Boolean)) {
    // Nothing was acknowledged and nothing was said, so the user would
    // otherwise see silence.
    await post(thread, event.message);
  }
  await clearShownInboundMessages(thread.id);
}
