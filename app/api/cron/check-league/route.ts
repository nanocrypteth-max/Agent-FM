import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateAITeam } from "@/lib/team-generator/generateTeam";
import { generateClubLogo } from "@/lib/svg/generateLogo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cron/check-league
 * Runs daily (Vercel Hobby: 0 0 * * *).
 * Checks ALL active leagues — for each one where all fixtures are SIMULATED,
 * creates a new season for that league's user.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all active leagues where all fixtures are simulated
  const activeLeagues = await prisma.league.findMany({
    where: { status: "ACTIVE" },
    include: { fixtures: { select: { status: true } }, teams: true },
  });

  const results: string[] = [];

  for (const league of activeLeagues) {
    const total = league.fixtures.length;
    const simulated = league.fixtures.filter(
      (f) => f.status === "SIMULATED",
    ).length;

    if (total === 0 || simulated < total) {
      results.push(`SKIP ${league.id}: ${simulated}/${total} fixtures done`);
      continue;
    }

    // Mark completed and create new season
    await prisma.league.update({
      where: { id: league.id },
      data: { status: "COMPLETED", endsAt: new Date() },
    });

    const newLeague = await prisma.league.create({
      data: {
        name: league.name,
        trophyName: league.trophyName,
        season: league.season + 1,
        status: "ACTIVE",
      },
    });

    // Clone teams into new league (age players +1, slight stamina decay)
    const userTeam = league.teams.find((t) => t.isUserControlled);
    const newTeamIds: string[] = [];

    for (const oldTeam of league.teams) {
      const oldPlayers = await prisma.player.findMany({
        where: { teamId: oldTeam.id },
      });

      const isAI = !oldTeam.isUserControlled;
      let logoSvg = oldTeam.logoSvg;
      let jerseyColor = oldTeam.jerseyColor;

      // Refresh AI team logo if needed
      if (isAI && !logoSvg) {
        const gen = generateAITeam(newLeague.id, league.teams.indexOf(oldTeam));
        logoSvg = gen.logoSvg;
        jerseyColor = gen.jerseyColor;
      }

      const newTeam = await prisma.team.create({
        data: {
          name: oldTeam.name,
          leagueId: newLeague.id,
          isUserControlled: oldTeam.isUserControlled,
          jerseyColor: jerseyColor ?? "#ff5252",
          logoSvg,
          overallAtk: oldTeam.overallAtk,
          overallMid: oldTeam.overallMid,
          overallDef: oldTeam.overallDef,
          budget: oldTeam.budget,
          formation: oldTeam.formation,
          players: {
            create: oldPlayers.map((p) => ({
              name: p.name,
              position: p.position,
              age: p.age + 1,
              nationality: p.nationality,
              pace: Math.max(30, p.pace - 1),
              shooting: p.shooting,
              passing: p.passing,
              defending: p.defending,
              stamina: Math.max(30, p.stamina - 1),
              starRating: p.starRating,
              marketValue: p.marketValue,
              avatarSvg: p.avatarSvg,
              fitness: 100,
              morale: 75,
              isInUserSquad: p.isInUserSquad,
            })),
          },
        },
      });
      newTeamIds.push(newTeam.id);
    }

    // Update user session to point to new team
    if (userTeam) {
      const newUserTeam = await prisma.team.findFirst({
        where: { leagueId: newLeague.id, isUserControlled: true },
      });
      if (newUserTeam) {
        await prisma.userSession.updateMany({
          where: { teamId: userTeam.id },
          data: { teamId: newUserTeam.id },
        });
      }
    }

    // Generate fixtures for new season
    const newTeams = await prisma.team.findMany({
      where: { leagueId: newLeague.id },
      select: { id: true },
    });
    const fixtures = generateRoundRobin(
      newTeams.map((t) => t.id),
      newLeague.id,
    );
    await prisma.fixture.createMany({ data: fixtures });

    // Portal notification
    await prisma.portalMessage.create({
      data: {
        type: "LEAGUE",
        title: `Season ${newLeague.season} Begins!`,
        content: `A new season of ${newLeague.name} has started. The ${newLeague.trophyName} is up for grabs. ${fixtures.length} fixtures scheduled.`,
        metadata: { leagueId: newLeague.id, season: newLeague.season },
      },
    });

    results.push(
      `NEW SEASON: ${newLeague.name} S${newLeague.season} (${fixtures.length} fixtures)`,
    );
  }

  return NextResponse.json({ processed: activeLeagues.length, results });
}

function generateRoundRobin(
  teamIds: string[],
  leagueId: string,
): Array<{
  leagueId: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
}> {
  const ids = [...teamIds];
  if (ids.length % 2 !== 0) ids.push("__BYE__");
  const n = ids.length;
  const fixtures: Array<{
    leagueId: string;
    round: number;
    homeTeamId: string;
    awayTeamId: string;
  }> = [];
  let arr = [...ids];

  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const home = arr[i];
      const away = arr[n - 1 - i];
      if (home !== "__BYE__" && away !== "__BYE__") {
        fixtures.push({
          leagueId,
          round: r + 1,
          homeTeamId: r % 2 === 0 ? home : away,
          awayTeamId: r % 2 === 0 ? away : home,
        });
      }
    }
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  return fixtures;
}
