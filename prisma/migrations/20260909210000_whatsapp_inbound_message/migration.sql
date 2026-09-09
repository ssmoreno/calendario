-- CreateTable
CREATE TABLE "whatsapp_inbound_message" (
    "threadId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_inbound_message_pkey" PRIMARY KEY ("threadId")
);

ALTER TABLE "whatsapp_inbound_message" ENABLE ROW LEVEL SECURITY;
