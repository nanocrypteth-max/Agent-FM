import { prisma } from "@/lib/prisma";
import { generateUserTeam, generateAITeam } from "./generateTeam";

const AI_TEAM_COUNT = 7; // 1 user + 7 AI = 8 teams total

const LEAGUE_NAMES = [
  ["World Stage Premier League", "The Golden Globe Trophy"],
  ["Continental Masters League", "The Diamond Cup"],
  ["Elite Championship Series", "The Platinum Shield"],
  ["Grand Prix Football League", "The Champions Chalice"],
  ["Intercontinental Super League", "The Crystal Trophy"],
  ["Global Invitational League", "The World Stage Cup"],
];

/**
 * Creates a brand new league for a user wallet:
 * - 1 user-controlled team (generated from wallet address)
 * - 7 AI teams (generated procedurally)
 * - Full round-robin fixture schedule
 * Returns the created league ID.
 */
export async function createLeagueForWallet(walletAddress: string): Promise<string> {
  const leagueSeed = walletAddress.slice(0, 16);
  const [leagueName, trophyName] = LEAGUE_NAMES[
    Math.floor(Math.random() * LEAGUE_NAMES.length)
  ];

  // Generate user team data
  const userTeamData = generateUserTeam(walletAddress);

  // Generate 7 AI teams
  const aiTeamsData = Array.from({ length: AI_TEAM_COUNT }, (_, i) =>
    generateAITeam(leagueSeed, i)
  );

  // Create league + all teams in one transaction
  const league = await prisma.league.create({
    data: {
      name: leagueName,
      trophyName,
      season: 1,
      status: "ACTIVE",
      teams: {
        create: [
          // User team first
          {
            name: userTeamData.name,
            jerseyColor: userTeamData.jerseyColor,
            logoSvg: userTeamData.logoSvg,
            overallAtk: userTeamData.overallAtk,
            overallMid: userTeamData.overallMid,
            overallDef: userTeamData.overallDef,
            isUserControlled: true,
            budget: 5_000_000,
            players: { create: userTeamData.players },
          },
          // AI teams
          ...aiTeamsData.map((t) => ({
            name: t.name,
            jerseyColor: t.jerseyColor,
            logoSvg: t.logoSvg,
            overallAtk: t.overallAtk,
            overallMid: t.overallMid,
            overallDef: t.overallDef,
            isUserControlled: false,
            budget: 5_000_000,
            players: { create: t.players },
          })),
        ],
      },
    },
    include: { teams: { select: { id: true, isUserControlled: true } } },
  });

  // Generate round-robin fixtures
  const teamIds = league.teams.map((t) => t.id);
  const fixtures = generateRoundRobin(teamIds, league.id);
  await prisma.fixture.createMany({ data: fixtures });

  // Add welcome portal message
  const userTeam = league.teams.find((t) => t.isUserControlled);
  await prisma.portalMessage.create({
    data: {
      type: "LEAGUE",
      title: `Welcome to ${leagueName}!`,
      content: `Your club "${userTeamData.name}" has been created and entered into ${leagueName}. The ${trophyName} awaits. 7 AI managers stand between you and glory. Good luck, Manager.`,
      metadata: { leagueId: league.id, trophyName },
    },
  });

  return userTeam!.id; // return user team ID for session creation
}

// ─── Round-robin generator ────────────────────────────────────────────────────

function generateRoundRobin(
  teamIds: string[],
  leagueId: string
): Array<{ leagueId: string; round: number; homeTeamId: string; awayTeamId: string }> {
  const ids = [...teamIds];
  if (ids.length % 2 !== 0) ids.push("__BYE__");

  const n = ids.length;
  const fixtures: Array<{ leagueId: string; round: number; homeTeamId: string; awayTeamId: string }> = [];
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
