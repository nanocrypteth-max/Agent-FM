import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pusher, CHANNELS, EVENTS } from "@/lib/pusher/server";
import { simulateMatch } from "@/lib/match-engine/simulate";
import {
  buildFallbackTactics,
  toMatchEngineTactics,
} from "@/lib/ai-agent/generate-tactics";
import { redis, KEYS } from "@/lib/redis/client";
import type { MatchSimInput } from "@/lib/match-engine/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } },
) {
  const { solanaWallet } = await req.json();
  const code = params.code.toUpperCase();

  const session = await prisma.userSession.findUnique({
    where: { solanaWallet },
  });
  const lobby = await prisma.friendlyMatch.findUnique({
    where: { code },
    include: {
      hostTeam: { include: { players: true } },
      guestTeam: { include: { players: true } },
    },
  });

  if (!lobby || !session || lobby.hostTeamId !== session.teamId) {
    return NextResponse.json(
      { error: "Not authorized or lobby not found" },
      { status: 403 },
    );
  }
  if (!lobby.hostReady || !lobby.guestReady) {
    return NextResponse.json(
      { error: "Both players must be ready" },
      { status: 400 },
    );
  }
  if (!lobby.guestTeam) {
    return NextResponse.json({ error: "No guest team" }, { status: 400 });
  }

  const MIN_PLAYERS = 12;
  if (lobby.hostTeam.players.length < MIN_PLAYERS) {
    return NextResponse.json(
      {
        error: `${lobby.hostTeam.name} needs at least ${MIN_PLAYERS} players.`,
      },
      { status: 400 },
    );
  }
  if (lobby.guestTeam.players.length < MIN_PLAYERS) {
    return NextResponse.json(
      {
        error: `${lobby.guestTeam.name} needs at least ${MIN_PLAYERS} players.`,
      },
      { status: 400 },
    );
  }

  // Distributed lock — prevent double simulate
  const lockKey = KEYS.matchLock(lobby.id);
  const acquired = await redis.set(lockKey, "1", { nx: true, ex: 120 });
  if (!acquired)
    return NextResponse.json(
      { error: "Match already being simulated" },
      { status: 409 },
    );

  try {
    const makeSquad = (team: typeof lobby.hostTeam) =>
      team.players.map((p) => ({
        id: p.id,
        name: p.name,
        position: p.position as "GK" | "DF" | "MF" | "FW",
        pace: p.pace,
        shooting: p.shooting,
        passing: p.passing,
        defending: p.defending,
        stamina: p.stamina,
      }));

    const hostTactics = buildFallbackTactics(makeSquad(lobby.hostTeam));
    const guestTactics = buildFallbackTactics(makeSquad(lobby.guestTeam));

    const simInput: MatchSimInput = {
      homeTeam: {
        id: lobby.hostTeam.id,
        overallAtk: lobby.hostTeam.overallAtk,
        overallMid: lobby.hostTeam.overallMid,
        overallDef: lobby.hostTeam.overallDef,
        players: lobby.hostTeam.players,
      },
      awayTeam: {
        id: lobby.guestTeam.id,
        overallAtk: lobby.guestTeam.overallAtk,
        overallMid: lobby.guestTeam.overallMid,
        overallDef: lobby.guestTeam.overallDef,
        players: lobby.guestTeam.players,
      },
      homeTactics: toMatchEngineTactics(hostTactics),
      awayTactics: toMatchEngineTactics(guestTactics),
    };

    const result = simulateMatch(simInput, lobby.id);

    // Save result to DB first — client will fetch and replay locally (same as league match)
    const matchResult = await prisma.matchResult.create({
      data: {
        friendlyId: lobby.id,
        homeTactics: hostTactics as any,
        awayTactics: guestTactics as any,
        events: result.events as any,
        homeExpGained: 0,
        awayExpGained: 0,
      },
    });

    await prisma.friendlyMatch.update({
      where: { id: lobby.id },
      data: { status: "COMPLETED" },
    });

    // Award EXP (non-blocking)
    awardFriendlyExp({
      homeTeamId: lobby.hostTeamId,
      awayTeamId: lobby.guestTeam.id,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
    }).catch(() => {});

    // EXP values for popup
    const EXP = { WIN: 25, DRAW: 10, LOSS: 5 };
    const homeRes =
      result.homeScore > result.awayScore
        ? "WIN"
        : result.homeScore < result.awayScore
          ? "LOSS"
          : "DRAW";
    const awayRes =
      homeRes === "WIN" ? "LOSS" : homeRes === "LOSS" ? "WIN" : "DRAW";

    const channel = CHANNELS.friendly(code);

    // Notify both clients: match is ready to replay.
    // Include ALL data needed by client: startingXIs + events + result.
    // Client fetches nothing — all data in this single Pusher event.
    await pusher.trigger(channel, "match-ready", {
      matchResultId: matchResult.id,
      homeStartingXI: hostTactics.startingXI,
      awayStartingXI: guestTactics.startingXI,
      events: result.events,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      homeExpGained: EXP[homeRes],
      awayExpGained: EXP[awayRes],
      homeTeamId: lobby.hostTeamId,
      awayTeamId: lobby.guestTeam.id,
    });

    return NextResponse.json({ success: true });
  } finally {
    await redis.del(lockKey);
  }
}

async function awardFriendlyExp({
  homeTeamId,
  awayTeamId,
  homeScore,
  awayScore,
}: {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
}) {
  const EXP = { WIN: 25, DRAW: 10, LOSS: 5 };
  const [homeSession, awaySession] = await Promise.all([
    prisma.userSession.findUnique({ where: { teamId: homeTeamId } }),
    prisma.userSession.findUnique({ where: { teamId: awayTeamId } }),
  ]);
  const homeResult =
    homeScore > awayScore ? "WIN" : homeScore < awayScore ? "LOSS" : "DRAW";
  const awayResult =
    homeResult === "WIN" ? "LOSS" : homeResult === "LOSS" ? "WIN" : "DRAW";
  const updates = [];
  if (homeSession)
    updates.push(
      prisma.userSession.update({
        where: { id: homeSession.id },
        data: { managerExp: { increment: EXP[homeResult] } },
      }),
    );
  if (awaySession)
    updates.push(
      prisma.userSession.update({
        where: { id: awaySession.id },
        data: { managerExp: { increment: EXP[awayResult] } },
      }),
    );
  await Promise.all(updates);
}
