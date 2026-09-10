import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  whatsAppInboundMessage: {
    upsert: vi.fn(),
  },
}));

vi.mock("./db", () => ({ prisma: db }));

import { recordInboundMessage } from "./whatsapp-inbound-store";

describe("recordInboundMessage", () => {
  beforeEach(() => {
    db.whatsAppInboundMessage.upsert.mockReset().mockResolvedValue({});
  });

  it("records proof when the exact inbound link is already saved", async () => {
    await recordInboundMessage("thread-1", "message-1", "https://example.com", {
      alreadySaved: true,
    });

    expect(db.whatsAppInboundMessage.upsert).toHaveBeenCalledWith({
      where: {
        threadId_messageId: {
          threadId: "thread-1",
          messageId: "message-1",
        },
      },
      create: {
        threadId: "thread-1",
        messageId: "message-1",
        preview: "https://example.com",
        savedAt: expect.any(Date),
      },
      update: {
        preview: "https://example.com",
        savedAt: expect.any(Date),
      },
    });
  });

  it("does not claim unsaved messages were saved", async () => {
    await recordInboundMessage("thread-1", "message-2", "new note");

    expect(db.whatsAppInboundMessage.upsert).toHaveBeenCalledWith({
      where: {
        threadId_messageId: {
          threadId: "thread-1",
          messageId: "message-2",
        },
      },
      create: {
        threadId: "thread-1",
        messageId: "message-2",
        preview: "new note",
        savedAt: null,
      },
      update: { preview: "new note" },
    });
  });
});
