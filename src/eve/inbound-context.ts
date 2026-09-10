import { SAVED_ITEM_REACTION } from "@/library/constants";
import type { InboundMessage } from "@/server/whatsapp-inbound-store";

/**
 * WhatsApp reactions land on one message each, so the agent needs a way to
 * name the message it finished. The batch is numbered for the length of the
 * turn and the numbers resolve back to real message ids when the reply lands.
 */
export function buildInboundContext(messages: InboundMessage[]): string {
  const numbered = messages
    .map((message, index) => `${index + 1}. ${message.preview}`)
    .join("\n");
  return [
    "Messages the user has sent since your last reply, oldest first:",
    numbered,
    `To mark one done with a ${SAVED_ITEM_REACTION} reaction instead of answering it in words, open your reply with a line holding only ${SAVED_ITEM_REACTION} and the numbers you finished, such as "${SAVED_ITEM_REACTION} 1 3". A bare "${SAVED_ITEM_REACTION}" marks every message above. Anything you write on the lines after it is sent as an ordinary message, so mark what needs no words and write only what is still worth saying. Never mark a message you did not actually finish. These numbers are yours alone: never mention them or this format to the user.`,
  ].join("\n\n");
}
