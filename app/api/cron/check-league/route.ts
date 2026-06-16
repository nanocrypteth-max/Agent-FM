import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generatePlayerAvatar } from "@/lib/svg/generateAvatar";
import { generateClubLogo } from "@/lib/svg/generateLogo";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

// Vercel Cron will call this every hour
// Config in vercel.json: { "crons": [{ "path": "/api/cron/check-league", "schedule": "0 * * * *" }] }
export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeLeague = await prisma.league.findFirst({
    where: { status: "ACTIVE" },
    include: {
      fixtures: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!activeLeague) {
    return NextResponse.json({ message: "No active league found" });
  }

  const totalFixtures = activeLeague.fixtures.length;
  const simulatedFixtures = activeLeague.fixtures.filter((f) => f.status === "SIMULATED").length;

  // Only proceed if all fixtures are done (or no fixtures exist on brand new league)
  if (totalFixtures > 0 && simulatedFixtures < totalFixtures) {
    return NextResponse.json({
      message: "League still in progress",
      progress: `${simulatedFixtures}/${totalFixtures}`,
    });
  }

  // Mark current league as completed
  if (totalFixtures > 0) {
    await prisma.league.update({
      where: { id: activeLeague.id },
      data: { status: "COMPLETED", endsAt: new Date() },
    });
  }

  // Generate new league name + trophy via AI
  const { leagueName, trophyName } = await generateLeagueNames();

  // Create new league with same teams (new season)
  const newSeason = activeLeague.season + 1;
  const newLeague = await prisma.league.create({
    data: { name: leagueName, trophyName, season: newSeason, status: "ACTIVE" },
  });

  // Clone teams (reset tactics, keep players)
  const oldTeams = await prisma.team.findMany({
    where: { leagueId: activeLeague.id },
    include: { players: true },
  });

  for (const oldTeam of oldTeams) {
    await prisma.team.create({
      data: {
        name: oldTeam.name,
        leagueId: newLeague.id,
        isUserControlled: oldTeam.isUserControlled,
        jerseyColor: oldTeam.jerseyColor,
        logoSvg: oldTeam.logoSvg,
        overallAtk: oldTeam.overallAtk,
        overallMid: oldTeam.overallMid,
        overallDef: oldTeam.overallDef,
        budget: oldTeam.budget,
        formation: oldTeam.formation,
        players: {
          create: oldTeam.players.map((p) => ({
            name: p.name, position: p.position, age: p.age + 1,
            nationality: p.nationality,
            pace: Math.max(30, p.pace - 1),
            shooting: p.shooting, passing: p.passing,
            defending: p.defending,
            stamina: Math.max(30, p.stamina - 1),
            starRating: p.starRating,
            marketValue: p.marketValue,
            avatarSvg: p.avatarSvg,
            fitness: 100, morale: 75,
            isInUserSquad: p.isInUserSquad,
          })),
        },
      },
    });
  }

  // Generate fixtures for new league
  const newTeams = await prisma.team.findMany({ where: { leagueId: newLeague.id } });
  const roundRobin = generateRoundRobin(newTeams.map((t) => t.id));
  const fixturesData = roundRobin.flatMap((round, ri) =>
    round.map(([home, away]) => ({
      leagueId: newLeague.id,
      round: ri + 1,
      homeTeamId: home,
      awayTeamId: away,
    }))
  );
  await prisma.fixture.createMany({ data: fixturesData });

  // Portal announcement
  await prisma.portalMessage.create({
    data: {
      type: "LEAGUE",
      title: `🏆 New Tournament: ${leagueName}`,
      content: `Season ${newSeason} begins! The ${trophyName} is up for grabs. ${fixturesData.length} fixtures have been scheduled across ${roundRobin.length} matchdays. May the best manager win.`,
      metadata: { leagueId: newLeague.id, trophyName, season: newSeason },
    },
  });

  return NextResponse.json({
    success: true,
    newLeague: { id: newLeague.id, name: leagueName, trophyName, season: newSeason },
    fixtures: fixturesData.length,
  });
}

async function generateLeagueNames(): Promise<{ leagueName: string; trophyName: string }> {
  const fallbacks = [
    { leagueName: "Elite World Championship", trophyName: "The Golden Globe Trophy" },
    { leagueName: "Continental Masters League", trophyName: "The Diamond Cup" },
    { leagueName: "World Stage Invitational", trophyName: "The Platinum Shield" },
    { leagueName: "Grand Prix Football League", trophyName: "The Champions Chalice" },
  ];

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "your-gemini-api-key-here") {
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(
      `Generate a unique, exciting football league name and trophy name for a high-stakes World Stage 2026 tournament.
       Make it sound prestigious and epic. Respond ONLY with JSON (no markdown):
       {"leagueName": "...", "trophyName": "..."}`
    );
    const text = result.response.text().replace(/```json|```/g, "").trim();
    return JSON.parse(text);
  } catch {
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

function generateRoundRobin(teamIds: string[]): Array<Array<[string, string]>> {
  const ids = [...teamIds];
  if (ids.length % 2 !== 0) ids.push("__BYE__");
  const n = ids.length;
  const rounds: Array<Array<[string, string]>> = [];
  let arr = [...ids];
  for (let r = 0; r < n - 1; r++) {
    const round: Array<[string, string]> = [];
    for (let i = 0; i < n / 2; i++) {
      const home = arr[i], away = arr[n - 1 - i];
      if (home !== "__BYE__" && away !== "__BYE__") {
        round.push(r % 2 === 0 ? [home, away] : [away, home]);
      }
    }
    rounds.push(round);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  return rounds;
}
