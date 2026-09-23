import { createPostgresState } from "@chat-adapter/state-pg";
import { createKapsoAdapter } from "@kapso/chat-adapter";
import type { Message, Thread } from "chat";
import { chatSdkChannel } from "eve/channels/chat-sdk";
import { Pool } from "pg";

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

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}
const chatStatePool = new Pool({
  connectionString: databaseUrl,
  max: 2,
});

export const { bot, channel, send } = chatSdkChannel({
  adapters: { kapso: adapter },
  state: createPostgresState({
    client: chatStatePool,
    keyPrefix: "calendario-kapso",
  }),
  concurrency: "concurrent",
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
