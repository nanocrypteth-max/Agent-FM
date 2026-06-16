/*
  Warnings:

  - You are about to drop the column `privyUserId` on the `UserSession` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "UserSession_privyUserId_key";

-- AlterTable
ALTER TABLE "UserSession" DROP COLUMN "privyUserId",
ADD COLUMN     "avatarBase64" TEXT,
ADD COLUMN     "displayName" TEXT;
