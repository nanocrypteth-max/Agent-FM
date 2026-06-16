-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
