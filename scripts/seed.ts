import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed script for multi-user mode.
 * Clears all data — each user's league/team is created automatically
 * when they connect their wallet for the first time.
 *
 * Run this only to RESET the database (e.g. fresh deploy).
 * Do NOT run this in production unless you want to wipe all user data.
 */
async function main() {
  console.log("Resetting database for multi-user mode...\n");

  // Delete in FK-safe order
  await prisma.userSquad.deleteMany();
  await prisma.gachaSpin.deleteMany();
  await prisma.portalMessage.deleteMany();
  await prisma.transferLog.deleteMany();
  await prisma.transferListing.deleteMany();
  await prisma.userTactics.deleteMany();
  await prisma.matchResult.deleteMany();
  await prisma.fixture.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.league.deleteMany();

  console.log("✓ Database cleared.");
  console.log("\nMulti-user mode: leagues and teams are created automatically");
  console.log("when each user connects their Phantom wallet.\n");
  console.log("No manual fixture generation needed — fixtures are created");
  console.log("automatically as part of league creation.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
