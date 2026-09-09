-- AlterTable
ALTER TABLE "library_item"
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "library_item"
RENAME COLUMN "name" TO "title";

-- Preserve each item's former collection as its first tag.
UPDATE "library_item" AS item
SET "tags" = ARRAY[category."name"]
FROM "category" AS category
WHERE item."categoryId" = category."id"
  AND item."userId" = category."userId";

-- Existing manual entry allowed duplicate links. Keep the oldest copy so the
-- new unique constraint can make agent retries idempotent, while retaining
-- every former category as a tag on that copy.
WITH merged AS (
  SELECT
    "userId",
    "link",
    ARRAY_AGG(DISTINCT tag ORDER BY tag) AS "tags"
  FROM "library_item", UNNEST("tags") AS tag
  GROUP BY "userId", "link"
)
UPDATE "library_item" AS item
SET "tags" = merged."tags"
FROM merged
WHERE item."userId" = merged."userId"
  AND item."link" = merged."link";

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "link"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS position
  FROM "library_item"
)
DELETE FROM "library_item" AS item
USING ranked
WHERE item."id" = ranked."id"
  AND ranked.position > 1;

-- DropForeignKey
ALTER TABLE "library_item"
DROP CONSTRAINT "library_item_categoryId_userId_fkey";

-- AlterTable
ALTER TABLE "library_item"
DROP COLUMN "categoryId";

-- DropTable
DROP TABLE "category";

-- CreateIndex
CREATE UNIQUE INDEX "library_item_userId_link_key"
ON "library_item"("userId", "link");

-- CreateIndex
CREATE INDEX "library_item_userId_createdAt_idx"
ON "library_item"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "library_item_tags_idx"
ON "library_item" USING GIN ("tags");
