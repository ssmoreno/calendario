-- CreateTable
CREATE TABLE "reminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reminder_userId_remindAt_idx" ON "reminder"("userId", "remindAt");

-- CreateIndex
CREATE INDEX "reminder_deliveredAt_remindAt_idx" ON "reminder"("deliveredAt", "remindAt");

-- CreateIndex
CREATE INDEX "reminder_leaseToken_idx" ON "reminder"("leaseToken");

-- AddForeignKey
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Match the row-level security posture of every other application table.
ALTER TABLE "reminder" ENABLE ROW LEVEL SECURITY;
