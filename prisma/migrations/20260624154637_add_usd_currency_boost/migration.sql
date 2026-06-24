-- AlterTable
ALTER TABLE "TransferListing" ADD COLUMN     "isUSDListing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceUSD" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "UserSession" ADD COLUMN     "usdBalance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "BoostLog" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "stat" TEXT NOT NULL,
    "gain" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "solPaid" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoostLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoostLog_playerId_idx" ON "BoostLog"("playerId");

-- CreateIndex
CREATE INDEX "BoostLog_wallet_idx" ON "BoostLog"("wallet");
