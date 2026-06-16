/**
 * Simulates all SCHEDULED fixtures for a given round number.
 * Usage: tsx scripts/simulate-round.ts <round_number>
 *
 * Note: if the user's team has a fixture in this round, you must submit
 * tactics via the UI first — this script will skip that fixture with a warning.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const round = parseInt(process.argv[2] ?? "1", 10);
  if (isNaN(round)) {
    console.error("Usage: tsx scripts/simulate-round.ts <round_number>");
    process.exit(1);
  }

  const fixtures = await prisma.fixture.findMany({
    where: { round, status: "SCHEDULED" },
    include: {
      homeTeam: { select: { name: true, isUserControlled: true } },
      awayTeam: { select: { name: true, isUserControlled: true } },
    },
  });

  if (fixtures.length === 0) {
    console.log(`No scheduled fixtures found for round ${round}.`);
    return;
  }

  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";

  for (const fx of fixtures) {
    const hasUserTeam = fx.homeTeam.isUserControlled || fx.awayTeam.isUserControlled;

    if (hasUserTeam) {
      const userTactics = await prisma.userTactics.findUnique({ where: { fixtureId: fx.id } });
      if (!userTactics) {
        console.log(
          `SKIP: ${fx.homeTeam.name} vs ${fx.awayTeam.name} — submit your tactics via the UI first (fixture ${fx.id})`
        );
        continue;
      }
    }

    const res = await fetch(`${baseUrl}/api/fixtures/${fx.id}/simulate`, { method: "POST" });
    const json = await res.json();

    if (!res.ok) {
      console.error(`FAIL: ${fx.homeTeam.name} vs ${fx.awayTeam.name} — ${json.error}`);
      continue;
    }

    console.log(`${fx.homeTeam.name} ${json.homeScore} - ${json.awayScore} ${fx.awayTeam.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
