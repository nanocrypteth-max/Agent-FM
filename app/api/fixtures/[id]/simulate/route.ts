import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { simulateMatch } from "@/lib/match-engine/simulate";
import {
  generateTactics,
  toMatchEngineTactics,
  TacticsResult,
} from "@/lib/ai-agent/generate-tactics";
import type { MatchSimInput, TeamMatchData } from "@/lib/match-engine/types";

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

    return NextResponse.json({
      fixtureId,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      matchResultId: matchResult.id,
      eventCount: result.events.length,
    });
  } catch (err: any) {
    // P2002 = unique constraint violation on MatchResult.fixtureId (race condition:
    // another request simulated this fixture between our check and this write)
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
    return generateTactics({
      teamName: team.name,
      squad,
      opponentName: opponent.name,
      opponentOverall: {
        atk: opponent.overallAtk,
        mid: opponent.overallMid,
        def: opponent.overallDef,
      },
      context: "MATCH_SPECIFIC",
    });
  }

  if (team.baseTactics) {
    return team.baseTactics as TacticsResult;
  }

  const tactics = await generateTactics({
    teamName: team.name,
    squad,
    context: "SEASON_BASE",
  });

  await prisma.team.update({
    where: { id: team.id },
    data: { baseTactics: tactics as any },
  });

  return tactics;
}
