-- The table only ever held a transient pointer to the newest inbound message,
-- so it is rebuilt rather than migrated: one row per message awaiting a tick.
DROP TABLE "whatsapp_inbound_message";

-- CreateTable
CREATE TABLE "whatsapp_inbound_message" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "preview" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shownAt" TIMESTAMP(3),

    CONSTRAINT "whatsapp_inbound_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_inbound_message_threadId_messageId_key" ON "whatsapp_inbound_message"("threadId", "messageId");

-- CreateIndex
CREATE INDEX "whatsapp_inbound_message_threadId_receivedAt_idx" ON "whatsapp_inbound_message"("threadId", "receivedAt");

ALTER TABLE "whatsapp_inbound_message" ENABLE ROW LEVEL SECURITY;
