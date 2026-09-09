import { describe, expect, it, vi } from "vitest";
import type { Thread } from "chat";

const storeMocks = vi.hoisted(() => ({
  latestInboundMessageId: vi.fn(),
}));

vi.mock("@/server/whatsapp-inbound-store", () => ({
  latestInboundMessageId: storeMocks.latestInboundMessageId,
}));

import { deliverWhatsAppMessage, SAVED_ITEM_REACTION } from "./delivery";

function threadWith(messageId: string | undefined) {
  const addReaction = vi.fn().mockResolvedValue(undefined);
  const post = vi.fn().mockResolvedValue(undefined);
  storeMocks.latestInboundMessageId.mockResolvedValue(messageId ?? null);
  const thread = {
    adapter: { addReaction },
    id: "kapso:phone:user",
    post,
  } as unknown as Thread;
  return { addReaction, post, thread };
}

describe("deliverWhatsAppMessage", () => {
  it("posts ordinary final replies", async () => {
    const { addReaction, post, thread } = threadWith("message-1");

    await deliverWhatsAppMessage(
      { finishReason: "stop", message: "Agendado." },
      thread,
    );

    expect(post).toHaveBeenCalledWith({ markdown: "Agendado." });
    expect(addReaction).not.toHaveBeenCalled();
  });

  it("reacts to the newest inbound message, not the one that opened the session", async () => {
    const { addReaction, post, thread } = threadWith("message-9");

    await deliverWhatsAppMessage(
      { finishReason: "stop", message: SAVED_ITEM_REACTION },
      thread,
    );

    expect(storeMocks.latestInboundMessageId).toHaveBeenCalledWith(
      "kapso:phone:user",
    );
    expect(addReaction).toHaveBeenCalledWith(
      "kapso:phone:user",
      "message-9",
      SAVED_ITEM_REACTION,
    );
    expect(post).not.toHaveBeenCalled();
  });

  it("posts the confirmation when no inbound message was recorded", async () => {
    const { addReaction, post, thread } = threadWith(undefined);

    await deliverWhatsAppMessage(
      { finishReason: "stop", message: SAVED_ITEM_REACTION },
      thread,
    );

    expect(addReaction).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith({ markdown: SAVED_ITEM_REACTION });
  });

  it("posts the confirmation when the platform rejects the reaction", async () => {
    const { addReaction, post, thread } = threadWith("message-1");
    addReaction.mockRejectedValueOnce(new Error("reaction unavailable"));

    await deliverWhatsAppMessage(
      { finishReason: "stop", message: SAVED_ITEM_REACTION },
      thread,
    );

    expect(post).toHaveBeenCalledWith({ markdown: SAVED_ITEM_REACTION });
  });

  it("ignores intermediate tool-call messages", async () => {
    const { addReaction, post, thread } = threadWith("message-1");

    await deliverWhatsAppMessage(
      { finishReason: "tool-calls", message: SAVED_ITEM_REACTION },
      thread,
    );

    expect(addReaction).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });
});
