-- CreateTable
CREATE TABLE "saved_item" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT,
    "summary" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'link',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_item_userId_createdAt_idx" ON "saved_item"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "saved_item_userId_url_key" ON "saved_item"("userId", "url");

-- AddForeignKey
ALTER TABLE "saved_item" ADD CONSTRAINT "saved_item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
