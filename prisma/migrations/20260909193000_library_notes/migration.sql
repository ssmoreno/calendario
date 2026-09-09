ALTER TABLE "library_item" RENAME COLUMN "summary" TO "note";
ALTER TABLE "library_item" RENAME COLUMN "attachmentIdentity" TO "unlinkedIdentity";

ALTER INDEX "library_item_userId_attachmentIdentity_key"
RENAME TO "library_item_userId_unlinkedIdentity_key";
