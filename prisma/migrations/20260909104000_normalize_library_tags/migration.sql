-- CreateTable
CREATE TABLE "library_tag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_item_tag" (
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "library_item_tag_pkey" PRIMARY KEY ("itemId", "tagId")
);

-- Preserve every existing tag as one case-insensitive, user-owned record.
WITH expanded_tags AS (
    SELECT
        item."userId",
        BTRIM(REGEXP_REPLACE(item_tag.name, '\s+', ' ', 'g')) AS name,
        LOWER(BTRIM(REGEXP_REPLACE(item_tag.name, '\s+', ' ', 'g'))) AS normalized_name,
        item."createdAt" AS item_created_at,
        item."id" AS item_id,
        item_tag.position
    FROM "library_item" AS item
    CROSS JOIN LATERAL UNNEST(item."tags") WITH ORDINALITY
      AS item_tag(name, position)
    WHERE BTRIM(item_tag.name) <> ''
), unique_tags AS (
    SELECT DISTINCT ON ("userId", normalized_name)
        "userId",
        name,
        normalized_name
    FROM expanded_tags
    ORDER BY
        "userId",
        normalized_name,
        item_created_at,
        item_id,
        position
)
INSERT INTO "library_tag" (
    "id",
    "userId",
    "name",
    "normalizedName",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT('migrated_', MD5("userId" || ':' || normalized_name)),
    "userId",
    name,
    normalized_name,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM unique_tags;

-- Preserve the tags assigned to each item.
INSERT INTO "library_item_tag" ("userId", "itemId", "tagId")
SELECT DISTINCT item."userId", item."id", tag."id"
FROM "library_item" AS item
CROSS JOIN UNNEST(item."tags") AS item_tag(name)
JOIN "library_tag" AS tag
  ON tag."userId" = item."userId"
 AND tag."normalizedName" = LOWER(
      BTRIM(REGEXP_REPLACE(item_tag.name, '\s+', ' ', 'g'))
    );

-- DropIndex
DROP INDEX "library_item_tags_idx";

-- AlterTable
ALTER TABLE "library_item" DROP COLUMN "tags";

-- CreateIndex
CREATE UNIQUE INDEX "library_item_id_userId_key"
ON "library_item"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "library_tag_userId_normalizedName_key"
ON "library_tag"("userId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "library_tag_id_userId_key"
ON "library_tag"("id", "userId");

-- CreateIndex
CREATE INDEX "library_tag_userId_createdAt_idx"
ON "library_tag"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "library_item_tag_tagId_userId_idx"
ON "library_item_tag"("tagId", "userId");

-- AddForeignKey
ALTER TABLE "library_tag"
ADD CONSTRAINT "library_tag_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_item_tag"
ADD CONSTRAINT "library_item_tag_itemId_userId_fkey"
FOREIGN KEY ("itemId", "userId") REFERENCES "library_item"("id", "userId")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_item_tag"
ADD CONSTRAINT "library_item_tag_tagId_userId_fkey"
FOREIGN KEY ("tagId", "userId") REFERENCES "library_tag"("id", "userId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "library_tag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "library_item_tag" ENABLE ROW LEVEL SECURITY;
