-- CreateTable
CREATE TABLE "StorePlayer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "nationality" TEXT NOT NULL,
    "starRating" INTEGER NOT NULL,
    "pace" INTEGER NOT NULL,
    "shooting" INTEGER NOT NULL,
    "passing" INTEGER NOT NULL,
    "defending" INTEGER NOT NULL,
    "stamina" INTEGER NOT NULL,
    "avatarSvg" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorePlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StorePlayer_starRating_available_idx" ON "StorePlayer"("starRating", "available");
