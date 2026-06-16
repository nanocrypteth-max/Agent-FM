-- CreateEnum
CREATE TYPE "LeagueStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('LISTED', 'SOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransferSource" AS ENUM ('MARKET', 'GACHA');

-- CreateEnum
CREATE TYPE "GachaTier" AS ENUM ('STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "SpinStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('NEWS', 'TRANSFER', 'LEAGUE', 'GACHA', 'SYSTEM');

-- AlterTable
ALTER TABLE "League" ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "LeagueStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "tier" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "trophyName" TEXT NOT NULL DEFAULT 'Championship Trophy';

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "age" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "avatarSvg" TEXT,
ADD COLUMN     "isInUserSquad" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketValue" INTEGER NOT NULL DEFAULT 100000,
ADD COLUMN     "nationality" TEXT NOT NULL DEFAULT 'International',
ADD COLUMN     "starRating" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "budget" INTEGER NOT NULL DEFAULT 5000000,
ADD COLUMN     "jerseyColor" TEXT NOT NULL DEFAULT '#ff5252',
ADD COLUMN     "logoSvg" TEXT;

-- CreateTable
CREATE TABLE "TransferListing" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "fromTeamId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'LISTED',
    "listedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldAt" TIMESTAMP(3),

    CONSTRAINT "TransferListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferLog" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "fromTeamId" TEXT,
    "toTeamId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "source" "TransferSource" NOT NULL DEFAULT 'MARKET',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GachaSpin" (
    "id" TEXT NOT NULL,
    "walletAddr" TEXT NOT NULL,
    "tier" "GachaTier" NOT NULL,
    "txHash" TEXT NOT NULL,
    "playerId" TEXT,
    "status" "SpinStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GachaSpin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalMessage" (
    "id" TEXT NOT NULL,
    "type" "MessageType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSquad" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "slotIndex" INTEGER,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSquad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransferListing_playerId_key" ON "TransferListing"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "GachaSpin_txHash_key" ON "GachaSpin"("txHash");

-- CreateIndex
CREATE UNIQUE INDEX "UserSquad_playerId_key" ON "UserSquad"("playerId");

-- AddForeignKey
ALTER TABLE "TransferListing" ADD CONSTRAINT "TransferListing_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferListing" ADD CONSTRAINT "TransferListing_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferLog" ADD CONSTRAINT "TransferLog_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferLog" ADD CONSTRAINT "TransferLog_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferLog" ADD CONSTRAINT "TransferLog_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
