import { createMemoryState } from "@chat-adapter/state-memory";
import { createKapsoAdapter } from "@kapso/chat-adapter";
import type { Message, Thread } from "chat";
import { chatSdkChannel } from "eve/channels/chat-sdk";

import { messages } from "../../src/calendar/messages";
import { isLibraryLinkSaved } from "../../src/server/library-store";
import { recordInboundMessage } from "../../src/server/whatsapp-inbound-store";
import {
  linkedUserId,
  redeemPairingCode,
} from "../../src/server/whatsapp-link-store";
import { extractPairingCode } from "../../src/whatsapp/pairing";
import { deliverWhatsAppMessage } from "../../src/whatsapp/delivery";
import {
  inboundMessagePreview,
  whatsAppMessageContent,
} from "../../src/whatsapp/inbound";

export const adapter = createKapsoAdapter();

export const { bot, channel, send } = chatSdkChannel({
  adapters: { kapso: adapter },
  state: createMemoryState(),
  streaming: false,
  turnPolicy: "queue",
  userName: "SS",
  events: {
    "message.completed": (event, channel) =>
      deliverWhatsAppMessage(event, channel.thread),
  },
});

bot.onDirectMessage(async (thread: Thread, message: Message) => {
  const { waId } = adapter.decodeThreadId(thread.id);
  const text = message.text.trim();
  const userId = await linkedUserId(waId);

  if (userId) {
    const content = await whatsAppMessageContent(message);
    if (!content) {
      await thread.post(messages.whatsapp.unsupportedContent);
      return;
    }
    const alreadySaved =
      typeof content === "string" &&
      (await isLibraryLinkSaved(userId, content));
    await recordInboundMessage(
      thread.id,
      message.id,
      inboundMessagePreview(message),
      { alreadySaved },
    );
    await send(content, {
      thread,
      auth: {
        attributes: { threadId: thread.id, waId },
        authenticator: "kapso",
        principalId: userId,
        principalType: "user",
        subject: userId,
      },
    });
    return;
  }

  const code = extractPairingCode(text);
  const paired = code ? await redeemPairingCode(code, waId) : null;
  await thread.post(
    paired ? messages.whatsapp.paired : messages.whatsapp.notConnected,
  );
});

export default channel;
