import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const leagueId = params.id;
  const body = await req.json().catch(() => ({}));
  const doubleRound = body.doubleRound ?? false;

  const teams = await prisma.team.findMany({
    where: { leagueId },
    select: { id: true },
  });

  if (teams.length < 2) {
    return NextResponse.json({ error: "League needs at least 2 teams" }, { status: 400 });
  }

  const existingCount = await prisma.fixture.count({ where: { leagueId } });
  if (existingCount > 0) {
    return NextResponse.json(
      { error: "Fixtures already generated for this league", existingCount },
      { status: 409 }
    );
  }

  const teamIds = teams.map((t) => t.id);
  const rounds = generateRoundRobin(teamIds);

  const fixturesData: Array<{
    leagueId: string;
    round: number;
    homeTeamId: string;
    awayTeamId: string;
  }> = [];

  rounds.forEach((round, roundIndex) => {
    round.forEach(([home, away]) => {
      fixturesData.push({ leagueId, round: roundIndex + 1, homeTeamId: home, awayTeamId: away });
    });
  });

  if (doubleRound) {
    const secondLegOffset = rounds.length;
    rounds.forEach((round, roundIndex) => {
      round.forEach(([home, away]) => {
        fixturesData.push({
          leagueId,
          round: secondLegOffset + roundIndex + 1,
          homeTeamId: away,
          awayTeamId: home,
        });
      });
    });
  }

  await prisma.fixture.createMany({ data: fixturesData });

  return NextResponse.json({
    leagueId,
    totalFixtures: fixturesData.length,
    totalRounds: doubleRound ? rounds.length * 2 : rounds.length,
  });
}

/**
 * Circle method round-robin generator.
 * Returns array of rounds, each round = array of [homeTeamId, awayTeamId] pairs.
 */
function generateRoundRobin(teamIds: string[]): Array<Array<[string, string]>> {
  const ids = [...teamIds];
  const hasBye = ids.length % 2 !== 0;
  if (hasBye) ids.push("__BYE__");

  const n = ids.length;
  const numRounds = n - 1;
  const half = n / 2;

  const rounds: Array<Array<[string, string]>> = [];
  let arr = [...ids];

  for (let r = 0; r < numRounds; r++) {
    const round: Array<[string, string]> = [];
    for (let i = 0; i < half; i++) {
      const home = arr[i];
      const away = arr[n - 1 - i];
      if (home !== "__BYE__" && away !== "__BYE__") {
        round.push(r % 2 === 0 ? [home, away] : [away, home]);
      }
    }
    rounds.push(round);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }

  return rounds;
}
