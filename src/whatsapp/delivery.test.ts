import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Thread } from "chat";

import { messages } from "@/calendar/messages";
import type { InboundMessage } from "@/server/whatsapp-inbound-store";

const storeMocks = vi.hoisted(() => ({
  clearShownInboundMessages: vi.fn(),
  shownInboundBatch: vi.fn(),
}));

vi.mock("@/server/whatsapp-inbound-store", () => ({
  clearShownInboundMessages: storeMocks.clearShownInboundMessages,
  shownInboundBatch: storeMocks.shownInboundBatch,
}));

import { deliverWhatsAppMessage, SAVED_ITEM_REACTION } from "./delivery";

function batchOf(...messageIds: string[]): InboundMessage[] {
  return messageIds.map((messageId) => ({ messageId, preview: messageId }));
}

function threadWith(batch: InboundMessage[], saved = true) {
  const addReaction = vi.fn().mockResolvedValue(undefined);
  const post = vi.fn().mockResolvedValue(undefined);
  storeMocks.shownInboundBatch.mockResolvedValue({ messages: batch, saved });
  storeMocks.clearShownInboundMessages.mockResolvedValue(undefined);
  const thread = {
    adapter: { addReaction },
    id: "kapso:phone:user",
    post,
  } as unknown as Thread;
  return { addReaction, post, thread };
}

function reactedIds(addReaction: ReturnType<typeof vi.fn>): string[] {
  return addReaction.mock.calls.map(([, messageId]) => messageId);
}

describe("deliverWhatsAppMessage", () => {
  beforeEach(() => {
    storeMocks.clearShownInboundMessages.mockClear();
    storeMocks.shownInboundBatch.mockClear();
  });

  it("posts ordinary final replies", async () => {
    const { addReaction, post, thread } = threadWith(batchOf("message-1"));

    await deliverWhatsAppMessage(
      { finishReason: "stop", message: "Agendado." },
      thread,
    );

    expect(post).toHaveBeenCalledWith({ markdown: "Agendado." });
    expect(addReaction).not.toHaveBeenCalled();
    expect(storeMocks.clearShownInboundMessages).toHaveBeenCalledWith(
      "kapso:phone:user",
    );
  });

  it("reacts to every message of the batch when no numbers are given", async () => {
    const { addReaction, post, thread } = threadWith(
      batchOf("message-8", "message-9"),
    );

    await deliverWhatsAppMessage(
      { finishReason: "stop", message: SAVED_ITEM_REACTION },
      thread,
    );

    expect(reactedIds(addReaction)).toEqual(["message-8", "message-9"]);
    expect(addReaction).toHaveBeenCalledWith(
      "kapso:phone:user",
      "message-8",
      SAVED_ITEM_REACTION,
    );
    expect(post).not.toHaveBeenCalled();
  });

  it("reacts only to the numbered messages", async () => {
    const { addReaction, post, thread } = threadWith(
      batchOf("message-1", "message-2", "message-3"),
    );

    await deliverWhatsAppMessage(
      { finishReason: "stop", message: `${SAVED_ITEM_REACTION} 1, 3` },
      thread,
    );

    expect(reactedIds(addReaction)).toEqual(["message-1", "message-3"]);
    expect(post).not.toHaveBeenCalled();
  });

  it("sends the rest of the reply alongside the reactions", async () => {
    const { addReaction, post, thread } = threadWith(
      batchOf("message-1", "message-2", "message-3"),
    );

    await deliverWhatsAppMessage(
      {
        finishReason: "stop",
        message: `${SAVED_ITEM_REACTION} 3\nGuardé el disco de Spinetta.`,
      },
      thread,
    );

    expect(reactedIds(addReaction)).toEqual(["message-3"]);
    expect(post).toHaveBeenCalledWith({
      markdown: "Guardé el disco de Spinetta.",
    });
  });

  it("ignores numbers that are no longer in the batch", async () => {
    const { addReaction, post, thread } = threadWith(batchOf("message-1"));

    await deliverWhatsAppMessage(
      { finishReason: "stop", message: `${SAVED_ITEM_REACTION} 1 4` },
      thread,
    );

    expect(reactedIds(addReaction)).toEqual(["message-1"]);
    expect(post).not.toHaveBeenCalled();
  });

  it("posts a reply that only mentions a checkmark", async () => {
    const { addReaction, post, thread } = threadWith(batchOf("message-1"));
    const message = `${SAVED_ITEM_REACTION} Guardado.`;

    await deliverWhatsAppMessage({ finishReason: "stop", message }, thread);

    expect(addReaction).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith({ markdown: message });
  });

  it("posts the confirmation when no inbound message was recorded", async () => {
    const { addReaction, post, thread } = threadWith([]);

    await deliverWhatsAppMessage(
      { finishReason: "stop", message: SAVED_ITEM_REACTION },
      thread,
    );

    expect(addReaction).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith({ markdown: SAVED_ITEM_REACTION });
  });

  it("posts the confirmation when the platform rejects the reaction", async () => {
    const { addReaction, post, thread } = threadWith(batchOf("message-1"));
    addReaction.mockRejectedValueOnce(new Error("reaction unavailable"));

    await deliverWhatsAppMessage(
      { finishReason: "stop", message: SAVED_ITEM_REACTION },
      thread,
    );

    expect(post).toHaveBeenCalledWith({ markdown: SAVED_ITEM_REACTION });
  });

  it("refuses to tick a turn that saved nothing", async () => {
    const { addReaction, post, thread } = threadWith(
      batchOf("message-1", "message-2"),
      false,
    );

    await deliverWhatsAppMessage(
      { finishReason: "stop", message: `${SAVED_ITEM_REACTION} 1 2` },
      thread,
    );

    expect(addReaction).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith({
      markdown: messages.whatsapp.notSaved,
    });
    expect(storeMocks.clearShownInboundMessages).toHaveBeenCalledWith(
      "kapso:phone:user",
    );
  });

  it("keeps the written reply of a turn that saved nothing", async () => {
    const { addReaction, post, thread } = threadWith(
      batchOf("message-1"),
      false,
    );

    await deliverWhatsAppMessage(
      {
        finishReason: "stop",
        message: `${SAVED_ITEM_REACTION} 1\nNo pude leer ese enlace.`,
      },
      thread,
    );

    expect(addReaction).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith({
      markdown: "No pude leer ese enlace.",
    });
  });

  it("ignores intermediate tool-call messages", async () => {
    const { addReaction, post, thread } = threadWith(batchOf("message-1"));

    await deliverWhatsAppMessage(
      { finishReason: "tool-calls", message: SAVED_ITEM_REACTION },
      thread,
    );

    expect(addReaction).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(storeMocks.clearShownInboundMessages).not.toHaveBeenCalled();
  });
});
