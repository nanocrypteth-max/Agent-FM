-- AlterEnum
ALTER TYPE "LeagueStatus" ADD VALUE 'WAITING';

-- CreateTable
CREATE TABLE "MatchmakingQueue" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leagueId" TEXT,

    CONSTRAINT "MatchmakingQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchmakingQueue_walletAddress_key" ON "MatchmakingQueue"("walletAddress");

-- CreateIndex
CREATE INDEX "MatchmakingQueue_leagueId_idx" ON "MatchmakingQueue"("leagueId");
