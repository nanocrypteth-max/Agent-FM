import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { simulateMatch } from "@/lib/match-engine/simulate";
import {
  buildFallbackTactics,
  toMatchEngineTactics,
  TacticsResult,
} from "@/lib/ai-agent/generate-tactics";
import type { MatchSimInput, TeamMatchData } from "@/lib/match-engine/types";
import { matchExpGain, levelFromExp } from "@/lib/exp/manager";
import {
  computeMVP,
  MVP_EXP_GAIN,
  STARTER_EXP_GAIN,
  playerLevelFromExp,
} from "@/lib/exp/player";

// Force dynamic rendering — this route queries the DB
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const OVERALL_DIFF_THRESHOLD = 15;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const fixtureId = params.id;

  const fixture = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    include: {
      homeTeam: { include: { players: true } },
      awayTeam: { include: { players: true } },
      matchResult: true,
    },
  });

  if (!fixture) {
    return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
  }

  if (fixture.status === "SIMULATED" && fixture.matchResult) {
    return NextResponse.json(
      {
        error: "Fixture already simulated",
        matchResultId: fixture.matchResult.id,
      },
      { status: 409 },
    );
  }

  // If user controls a team in this fixture, their tactics must be submitted first
  const userTeam = fixture.homeTeam.isUserControlled
    ? fixture.homeTeam
    : fixture.awayTeam.isUserControlled
      ? fixture.awayTeam
      : null;

  let userTacticsRecord: { tactics: unknown } | null = null;
  if (userTeam) {
    userTacticsRecord = await prisma.userTactics.findUnique({
      where: { fixtureId },
    });
    if (!userTacticsRecord) {
      return NextResponse.json(
        {
          error:
            "Submit your tactics via POST /api/fixtures/:id/tactics before simulating",
        },
        { status: 400 },
      );
    }
  }

  const [homeTactics, awayTactics] = await Promise.all([
    fixture.homeTeam.isUserControlled
      ? wrapUserTactics(userTacticsRecord!.tactics)
      : getOrGenerateTactics(fixture.homeTeam, fixture.awayTeam),
    fixture.awayTeam.isUserControlled
      ? wrapUserTactics(userTacticsRecord!.tactics)
      : getOrGenerateTactics(fixture.awayTeam, fixture.homeTeam),
  ]);

  const homeMatchData: TeamMatchData = {
    id: fixture.homeTeam.id,
    overallAtk: fixture.homeTeam.overallAtk,
    overallMid: fixture.homeTeam.overallMid,
    overallDef: fixture.homeTeam.overallDef,
    players: fixture.homeTeam.players,
  };

  const awayMatchData: TeamMatchData = {
    id: fixture.awayTeam.id,
    overallAtk: fixture.awayTeam.overallAtk,
    overallMid: fixture.awayTeam.overallMid,
    overallDef: fixture.awayTeam.overallDef,
    players: fixture.awayTeam.players,
  };

  const simInput: MatchSimInput = {
    homeTeam: homeMatchData,
    awayTeam: awayMatchData,
    homeTactics: toMatchEngineTactics(homeTactics),
    awayTactics: toMatchEngineTactics(awayTactics),
  };

  let result;
  try {
    result = simulateMatch(simInput, fixtureId);
  } catch (err) {
    // Most likely cause: invalid startingXI (e.g. wrong GK count) from user tactics
    return NextResponse.json(
      {
        error: `Simulation failed: ${err instanceof Error ? err.message : "unknown error"}`,
      },
      { status: 400 },
    );
  }

  try {
    const [matchResult] = await prisma.$transaction([
      prisma.matchResult.create({
        data: {
          fixtureId,
          homeTactics: homeTactics as any,
          awayTactics: awayTactics as any,
          events: result.events as any,
        },
      }),
      prisma.fixture.update({
        where: { id: fixtureId },
        data: {
          status: "SIMULATED",
          homeScore: result.homeScore,
          awayScore: result.awayScore,
        },
      }),
    ]);

    // ─── Award EXP (non-blocking, fire-and-forget) ───────────────────────────
    awardMatchExp({
      matchResultId: matchResult.id,
      homeTeamId: fixture.homeTeam.id,
      awayTeamId: fixture.awayTeam.id,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      events: result.events,
    }).catch((err) => console.error("[exp] award failed:", err));

    return NextResponse.json({
      fixtureId,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      matchResultId: matchResult.id,
      eventCount: result.events.length,
    });
  } catch (err: any) {
    if (err.code === "P2002") {
      const existing = await prisma.matchResult.findUnique({
        where: { fixtureId },
      });
      return NextResponse.json(
        {
          error: "Fixture already simulated (race condition)",
          matchResultId: existing?.id,
        },
        { status: 409 },
      );
    }
    throw err;
  }
}

/**
 * Award EXP to managers and MVP player after a match.
 * Called fire-and-forget so it never delays the match response.
 */
async function awardMatchExp({
  matchResultId,
  homeTeamId,
  awayTeamId,
  homeScore,
  awayScore,
  events,
}: {
  matchResultId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  events: any[];
}) {
  const [homeSession, awaySession] = await Promise.all([
    prisma.userSession.findUnique({ where: { teamId: homeTeamId } }),
    prisma.userSession.findUnique({ where: { teamId: awayTeamId } }),
  ]);

  const updates: Promise<unknown>[] = [];

  // Award manager EXP
  const awardManager = (
    session: {
      id: string;
      managerExp: number;
      managerLevel: number;
      solanaWallet: string;
      totalMatches: number;
      totalWins: number;
    } | null,
    result: "WIN" | "DRAW" | "LOSS",
  ) => {
    if (!session) return;
    const gained = matchExpGain(result, session.managerLevel);
    const newExp = session.managerExp + gained;
    const newLevel = levelFromExp(newExp);
    const leveledUp = newLevel > session.managerLevel;

    updates.push(
      prisma.userSession.update({
        where: { id: session.id },
        data: {
          managerExp: newExp,
          managerLevel: newLevel,
          totalMatches: { increment: 1 },
          ...(result === "WIN" ? { totalWins: { increment: 1 } } : {}),
        },
      }),
    );

    // Portal message with EXP summary
    updates.push(
      prisma.portalMessage.create({
        data: {
          type: "EXP",
          title: `Match Result: ${result} · +${gained} EXP`,
          content: `${result === "WIN" ? "🏆 Victory!" : result === "DRAW" ? "🤝 Draw." : "❌ Defeat."} You earned ${gained} EXP. Manager Level ${newLevel}${leveledUp ? " 🎉 LEVEL UP!" : ""} · Total: ${newExp} EXP.`,
          walletAddress: session.solanaWallet,
          metadata: { gained, newExp, newLevel, leveledUp },
        },
      }),
    );
  };

  if (homeScore > awayScore) {
    awardManager(homeSession, "WIN");
    awardManager(awaySession, "LOSS");
  } else if (homeScore < awayScore) {
    awardManager(homeSession, "LOSS");
    awardManager(awaySession, "WIN");
  } else {
    awardManager(homeSession, "DRAW");
    awardManager(awaySession, "DRAW");
  }

  // Award MVP player EXP
  const mvpPlayerId = computeMVP(events);
  if (mvpPlayerId) {
    const mvp = await prisma.player.findUnique({ where: { id: mvpPlayerId } });
    if (mvp) {
      const newExp = mvp.playerExp + MVP_EXP_GAIN;
      const newLevel = playerLevelFromExp(newExp);
      updates.push(
        prisma.player.update({
          where: { id: mvpPlayerId },
          data: { playerExp: newExp, playerLevel: newLevel },
        }),
        prisma.matchResult.update({
          where: { id: matchResultId },
          data: { mvpPlayerId },
        }),
      );
    }
  }

  await Promise.all(updates);
}

/**
 * Wraps a player-submitted TacticsInput into the TacticsResult shape with a
 * sentinel reasoning value — the frontend Decision Log renders "Your tactics"
 * instead of an AI quote when it sees this sentinel.
 */
function wrapUserTactics(tactics: unknown): Promise<TacticsResult> {
  const t = tactics as Omit<TacticsResult, "reasoning">;
  return Promise.resolve({
    ...t,
    reasoning: "__USER__",
  });
}

/**
 * Tactics caching strategy:
 * - If team has no `baseTactics`, generate SEASON_BASE tactics and cache.
 * - If opponent's overall rating differs significantly, generate MATCH_SPECIFIC
 *   tactics for this fixture only (not cached).
 * - Otherwise, reuse cached `baseTactics`.
 */
async function getOrGenerateTactics(
  team: {
    id: string;
    name: string;
    baseTactics: unknown;
    players: any[];
    overallAtk: number;
    overallMid: number;
    overallDef: number;
  },
  opponent: {
    name: string;
    overallAtk: number;
    overallMid: number;
    overallDef: number;
  },
): Promise<TacticsResult> {
  const squad = team.players.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    pace: p.pace,
    shooting: p.shooting,
    passing: p.passing,
    defending: p.defending,
    stamina: p.stamina,
  }));

  const teamOverallAvg =
    (team.overallAtk + team.overallMid + team.overallDef) / 3;
  const oppOverallAvg =
    (opponent.overallAtk + opponent.overallMid + opponent.overallDef) / 3;
  const overallDiff = Math.abs(teamOverallAvg - oppOverallAvg);

  if (overallDiff > OVERALL_DIFF_THRESHOLD) {
    return buildFallbackTactics(squad);
  }

  if (team.baseTactics) {
    return team.baseTactics as TacticsResult;
  }

  const tactics = buildFallbackTactics(squad);

  await prisma.team.update({
    where: { id: team.id },
    data: { baseTactics: tactics as any },
  });

  return tactics;
}
