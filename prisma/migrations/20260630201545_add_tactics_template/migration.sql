-- CreateTable
CREATE TABLE "TacticsTemplate" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formation" TEXT NOT NULL,
    "slots" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TacticsTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TacticsTemplate_walletAddress_idx" ON "TacticsTemplate"("walletAddress");
