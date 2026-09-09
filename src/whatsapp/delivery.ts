import type { Thread } from "chat";

import { SAVED_ITEM_REACTION } from "@/library/constants";

export { SAVED_ITEM_REACTION } from "@/library/constants";

interface CompletedMessage {
  finishReason: string;
  message?: string | null;
}

async function post(thread: Thread, message: string) {
  await thread.post({ markdown: message });
}

async function reactToCurrentMessage(thread: Thread): Promise<boolean> {
  const messageId = thread.toJSON().currentMessage?.id;
  if (!messageId) return false;

  try {
    await thread.adapter.addReaction(
      thread.id,
      messageId,
      SAVED_ITEM_REACTION,
    );
    return true;
  } catch {
    return false;
  }
}

export async function deliverWhatsAppMessage(
  event: CompletedMessage,
  thread: Thread | null,
): Promise<void> {
  if (event.finishReason === "tool-calls" || !event.message || !thread) return;
  if (
    event.message === SAVED_ITEM_REACTION &&
    (await reactToCurrentMessage(thread))
  ) {
    return;
  }
  await post(thread, event.message);
}
