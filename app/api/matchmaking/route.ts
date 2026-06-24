import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateUserTeam } from "@/lib/team-generator/generateTeam";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LEAGUE_SIZE = 8; // need 8 real users to start a league

const LEAGUE_NAMES = [
  ["World Stage Premier League", "The Golden Globe Trophy"],
  ["Continental Masters League", "The Diamond Cup"],
  ["Elite Championship Series", "The Platinum Shield"],
  ["Grand Prix Football League", "The Champions Chalice"],
  ["Global Invitational League", "The World Stage Cup"],
];

/**
 * POST /api/matchmaking
 * Body: { solanaWallet }
 * Join the matchmaking queue. If 8 players queued, create league for all.
 */
export async function POST(req: NextRequest) {
  const { solanaWallet } = await req.json();
  if (!solanaWallet) return NextResponse.json({ error: "solanaWallet required" }, { status: 400 });

  // Check if user already has an active league
  const session = await prisma.userSession.findUnique({ where: { solanaWallet } });
  if (session) {
    const team = await prisma.team.findUnique({ where: { id: session.teamId } });
    const league = team ? await prisma.league.findUnique({ where: { id: team.leagueId! } }) : null;
    if (league && league.status !== "COMPLETED") {
      return NextResponse.json({
        status: league.status === "WAITING" ? "waiting" : "in_league",
        leagueId: league.id,
        leagueStatus: league.status,
      });
    }
  }

  // Join or re-join queue
  await prisma.matchmakingQueue.upsert({
    where: { walletAddress: solanaWallet },
    create: { walletAddress: solanaWallet },
    update: { joinedAt: new Date(), leagueId: null },
  });

  // Check total in queue (no assigned league yet)
  const queue = await prisma.matchmakingQueue.findMany({
    where: { leagueId: null },
    orderBy: { joinedAt: "asc" },
    take: LEAGUE_SIZE,
  });

  if (queue.length < LEAGUE_SIZE) {
    return NextResponse.json({
      status: "waiting",
      queuePosition: queue.findIndex((q) => q.walletAddress === solanaWallet) + 1,
      playersInQueue: queue.length,
      playersNeeded: LEAGUE_SIZE,
    });
  }

  // 8 players ready — create league
  const [leagueName, trophyName] = LEAGUE_NAMES[Math.floor(Math.random() * LEAGUE_NAMES.length)];
  const wallets = queue.map((q) => q.walletAddress);

  // Generate team data for each user
  const teamDataList = wallets.map((w) => generateUserTeam(w));

  const league = await prisma.league.create({
    data: {
      name: leagueName,
      trophyName,
      season: 1,
      status: "ACTIVE",
      teams: {
        create: teamDataList.map((td) => ({
          name: td.name,
          jerseyColor: td.jerseyColor,
          logoSvg: td.logoSvg,
          overallAtk: td.overallAtk,
          overallMid: td.overallMid,
          overallDef: td.overallDef,
          isUserControlled: true, // ALL teams are user controlled
          budget: 5_000_000,
          players: { create: td.players },
        })),
      },
    },
    include: { teams: { select: { id: true } } },
  });

  // Generate round-robin fixtures
  const teamIds = league.teams.map((t) => t.id);
  const fixtures = generateRoundRobin(teamIds, league.id);
  await prisma.fixture.createMany({ data: fixtures });

  // Link each user session to their team + mark queue entry with leagueId
  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    const teamId = league.teams[i].id;

    await prisma.matchmakingQueue.update({
      where: { walletAddress: wallet },
      data: { leagueId: league.id },
    });

    const existingSession = await prisma.userSession.findUnique({ where: { solanaWallet: wallet } });
    if (existingSession) {
      await prisma.userSession.update({
        where: { solanaWallet: wallet },
        data: { teamId },
      });
    } else {
      await prisma.userSession.create({
        data: { solanaWallet: wallet, teamId },
      });
    }

    await prisma.portalMessage.create({
      data: {
        type: "LEAGUE",
        title: `🏆 League Ready: ${leagueName}`,
        content: `8 managers have joined! Your club has been entered into ${leagueName}. ${fixtures.length} fixtures scheduled. The ${trophyName} awaits — good luck!`,
        walletAddress: wallet,
        metadata: { leagueId: league.id },
      },
    });
  }

  return NextResponse.json({
    status: "league_created",
    leagueId: league.id,
    leagueName,
    playerCount: wallets.length,
    fixtureCount: fixtures.length,
  });
}

/**
 * GET /api/matchmaking?wallet=<address>
 * Check queue status for a wallet.
 */
export async function GET(req: NextRequest) {
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });

  const entry = await prisma.matchmakingQueue.findUnique({ where: { walletAddress: wallet } });
  if (!entry) return NextResponse.json({ status: "not_in_queue" });

  if (entry.leagueId) {
    const league = await prisma.league.findUnique({ where: { id: entry.leagueId } });
    return NextResponse.json({ status: "league_created", leagueId: entry.leagueId, leagueStatus: league?.status });
  }

  const queue = await prisma.matchmakingQueue.findMany({
    where: { leagueId: null },
    orderBy: { joinedAt: "asc" },
  });
  const pos = queue.findIndex((q) => q.walletAddress === wallet) + 1;

  return NextResponse.json({
    status: "waiting",
    queuePosition: pos,
    playersInQueue: queue.length,
    playersNeeded: LEAGUE_SIZE,
  });
}

function generateRoundRobin(teamIds: string[], leagueId: string) {
  const ids = [...teamIds];
  if (ids.length % 2 !== 0) ids.push("__BYE__");
  const n = ids.length;
  const fixtures: Array<{ leagueId: string; round: number; homeTeamId: string; awayTeamId: string }> = [];
  let arr = [...ids];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const home = arr[i], away = arr[n - 1 - i];
      if (home !== "__BYE__" && away !== "__BYE__") {
        fixtures.push({ leagueId, round: r + 1, homeTeamId: r % 2 === 0 ? home : away, awayTeamId: r % 2 === 0 ? away : home });
      }
    }
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  return fixtures;
}
