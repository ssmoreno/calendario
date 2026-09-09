import { describe, expect, it, vi } from "vitest";
import type { Thread } from "chat";

import { deliverWhatsAppMessage, SAVED_LINK_ACK } from "./delivery";

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

  it("reacts to the inbound message instead of posting the saved-link token", async () => {
    const { addReaction, post, thread } = threadWith("message-1");

    await deliverWhatsAppMessage(
      { finishReason: "stop", message: SAVED_LINK_ACK },
      thread,
    );

    expect(addReaction).toHaveBeenCalledWith(
      "kapso:phone:user",
      "message-1",
      expect.objectContaining({ name: "check" }),
    );
    expect(post).not.toHaveBeenCalled();
  });

  it("posts the token when reacting is unavailable", async () => {
    const { addReaction, post, thread } = threadWith("message-1");
    addReaction.mockRejectedValueOnce(new Error("not supported"));

    await deliverWhatsAppMessage(
      { finishReason: "stop", message: SAVED_LINK_ACK },
      thread,
    );

    expect(post).toHaveBeenCalledWith({ markdown: SAVED_LINK_ACK });
  });

  it("ignores intermediate tool-call messages", async () => {
    const { addReaction, post, thread } = threadWith("message-1");

    await deliverWhatsAppMessage(
      { finishReason: "tool-calls", message: SAVED_LINK_ACK },
      thread,
    );

    expect(addReaction).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });
});
