-- DropForeignKey
ALTER TABLE "saved_item" DROP CONSTRAINT "saved_item_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_memory" DROP CONSTRAINT "user_memory_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_settings" DROP CONSTRAINT "user_settings_userId_fkey";

-- DropTable
DROP TABLE "saved_item";

-- DropTable
DROP TABLE "user_memory";

-- DropTable
DROP TABLE "user_settings";

-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_item" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_userId_name_key" ON "category"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "category_id_userId_key" ON "category"("id", "userId");

-- CreateIndex
CREATE INDEX "library_item_userId_categoryId_createdAt_idx" ON "library_item"("userId", "categoryId", "createdAt");

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_item" ADD CONSTRAINT "library_item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_item" ADD CONSTRAINT "library_item_categoryId_userId_fkey" FOREIGN KEY ("categoryId", "userId") REFERENCES "category"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
