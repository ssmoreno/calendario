ALTER TABLE "library_item" ADD COLUMN "attachmentIdentity" TEXT;

CREATE UNIQUE INDEX "library_item_userId_attachmentIdentity_key"
ON "library_item"("userId", "attachmentIdentity");
