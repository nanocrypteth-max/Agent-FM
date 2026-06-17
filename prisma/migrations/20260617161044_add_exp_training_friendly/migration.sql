/*
  Warnings:

  - A unique constraint covering the columns `[friendlyId]` on the table `MatchResult` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[privyUserId]` on the table `UserSession` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sellerWallet` to the `TransferListing` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FriendlyStatus" AS ENUM ('WAITING', 'READY', 'PLAYING', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MessageType" ADD VALUE 'TRAINING';
ALTER TYPE "MessageType" ADD VALUE 'FRIENDLY';
ALTER TYPE "MessageType" ADD VALUE 'EXP';

-- AlterEnum
ALTER TYPE "TransferSource" ADD VALUE 'FRIENDLY';

-- DropForeignKey
ALTER TABLE "MatchResult" DROP CONSTRAINT "MatchResult_fixtureId_fkey";

-- AlterTable
ALTER TABLE "MatchResult" ADD COLUMN     "awayExpGained" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "friendlyId" TEXT,
ADD COLUMN     "homeExpGained" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mvpPlayerId" TEXT,
ALTER COLUMN "fixtureId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "playerExp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "playerLevel" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "PortalMessage" ADD COLUMN     "walletAddress" TEXT;

-- AlterTable
ALTER TABLE "TransferListing" ADD COLUMN     "escrowTxHash" TEXT,
ADD COLUMN     "isSOLListing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceSOL" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "sellerWallet" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "TransferLog" ADD COLUMN     "priceSOL" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "UserSession" ADD COLUMN     "managerExp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "managerLevel" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "privyUserId" TEXT,
ADD COLUMN     "totalMatches" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalWins" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TrainingLog" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "statGained" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "trainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FriendlyMatch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hostTeamId" TEXT NOT NULL,
    "guestTeamId" TEXT,
    "status" "FriendlyStatus" NOT NULL DEFAULT 'WAITING',
    "pusherChannel" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "hostReady" BOOLEAN NOT NULL DEFAULT false,
    "guestReady" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FriendlyMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingLog_playerId_idx" ON "TrainingLog"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingLog_playerId_date_key" ON "TrainingLog"("playerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FriendlyMatch_code_key" ON "FriendlyMatch"("code");

-- CreateIndex
CREATE INDEX "FriendlyMatch_code_idx" ON "FriendlyMatch"("code");

-- CreateIndex
CREATE INDEX "FriendlyMatch_status_idx" ON "FriendlyMatch"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MatchResult_friendlyId_key" ON "MatchResult"("friendlyId");

-- CreateIndex
CREATE INDEX "PortalMessage_walletAddress_idx" ON "PortalMessage"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_privyUserId_key" ON "UserSession"("privyUserId");

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_friendlyId_fkey" FOREIGN KEY ("friendlyId") REFERENCES "FriendlyMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_mvpPlayerId_fkey" FOREIGN KEY ("mvpPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingLog" ADD CONSTRAINT "TrainingLog_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendlyMatch" ADD CONSTRAINT "FriendlyMatch_hostTeamId_fkey" FOREIGN KEY ("hostTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendlyMatch" ADD CONSTRAINT "FriendlyMatch_guestTeamId_fkey" FOREIGN KEY ("guestTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
