import { createMemoryState } from "@chat-adapter/state-memory";
import { createKapsoAdapter } from "@kapso/chat-adapter";
import type { Message, Thread } from "chat";
import { chatSdkChannel } from "eve/channels/chat-sdk";

import { messages } from "../../src/calendar/messages";
import {
  linkedUserId,
  redeemPairingCode,
} from "../../src/server/whatsapp-link-store";
import { extractPairingCode } from "../../src/whatsapp/pairing";

const whatsapp = messages.whatsapp;

const adapter = createKapsoAdapter();

export const { bot, channel, send } = chatSdkChannel({
  adapters: { kapso: adapter },
  state: createMemoryState(),
  // WhatsApp cannot edit a sent message, and the agent is already told to
  // finish its work before it speaks, so one message per turn is the shape.
  streaming: false,
  // The default steers, cancelling an in-flight turn when the next message
  // lands. People send three short texts in a row here, and eve does not roll
  // back side effects a cancelled turn already committed.
  turnPolicy: "queue",
  userName: "SS",
});

/**
 * The auth boundary for this surface. A WhatsApp number is only an account once
 * someone has proved they hold both, so an unlinked sender is answered here and
 * never reaches the agent — no session, no model call, no calendar.
 */
bot.onDirectMessage(async (thread: Thread, message: Message) => {
  const { waId } = adapter.decodeThreadId(thread.id);
  const text = message.text.trim();

  const userId = await linkedUserId(waId);
  if (userId) {
    if (!text) {
      await thread.post(whatsapp.textOnly);
      return;
    }
    await send(text, {
      thread,
      auth: {
        attributes: { waId },
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
  await thread.post(paired ? whatsapp.paired : whatsapp.notConnected);
});

export default channel;
