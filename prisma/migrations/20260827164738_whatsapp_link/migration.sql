-- CreateTable
CREATE TABLE "whatsapp_link" (
    "waId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_link_pkey" PRIMARY KEY ("waId")
);

-- CreateTable
CREATE TABLE "whatsapp_pairing_code" (
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_pairing_code_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_link_userId_key" ON "whatsapp_link"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_pairing_code_userId_key" ON "whatsapp_pairing_code"("userId");

-- AddForeignKey
ALTER TABLE "whatsapp_link" ADD CONSTRAINT "whatsapp_link_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_pairing_code" ADD CONSTRAINT "whatsapp_pairing_code_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

