import { describe, expect, it, vi } from "vitest";
import type { Thread } from "chat";

import { deliverWhatsAppMessage, SAVED_ITEM_REACTION } from "./delivery";

function threadWith(messageId: string | undefined) {
  const addReaction = vi.fn().mockResolvedValue(undefined);
  const post = vi.fn().mockResolvedValue(undefined);
  const thread = {
    adapter: { addReaction },
    id: "kapso:phone:user",
    post,
    toJSON: () => ({
      _type: "chat:Thread" as const,
      adapterName: "kapso",
      channelId: "kapso:phone",
      currentMessage: messageId ? { id: messageId } : undefined,
      id: "kapso:phone:user",
      isDM: true,
    }),
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

  it("reacts to the saved item without posting a separate reply", async () => {
    const { addReaction, post, thread } = threadWith("message-1");

    await deliverWhatsAppMessage(
      { finishReason: "stop", message: SAVED_ITEM_REACTION },
      thread,
    );

    expect(addReaction).toHaveBeenCalledWith(
      "kapso:phone:user",
      "message-1",
      SAVED_ITEM_REACTION,
    );
    expect(post).not.toHaveBeenCalled();
  });

  it("posts the confirmation when the inbound message cannot be resolved", async () => {
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
