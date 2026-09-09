import { emoji, type Thread } from "chat";

export const SAVED_LINK_ACK = "✅";

interface CompletedMessage {
  finishReason: string;
  message?: string | null;
}

async function post(thread: Thread, message: string) {
  await thread.post({ markdown: message });
}

export async function deliverWhatsAppMessage(
  event: CompletedMessage,
  thread: Thread | null,
): Promise<void> {
  if (event.finishReason === "tool-calls" || !event.message || !thread) return;
  if (event.message.trim() !== SAVED_LINK_ACK) {
    await post(thread, event.message);
    return;
  }

  const inboundMessageId = thread.toJSON().currentMessage?.id;
  if (inboundMessageId) {
    try {
      await thread.adapter.addReaction(thread.id, inboundMessageId, emoji.check);
      return;
    } catch {
      // A visible acknowledgment is more important than the optional reaction.
    }
  }
  await post(thread, SAVED_LINK_ACK);
}
