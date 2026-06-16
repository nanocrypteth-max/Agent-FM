-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "solanaWallet" TEXT NOT NULL,
    "privyUserId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_solanaWallet_key" ON "UserSession"("solanaWallet");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_privyUserId_key" ON "UserSession"("privyUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_teamId_key" ON "UserSession"("teamId");
