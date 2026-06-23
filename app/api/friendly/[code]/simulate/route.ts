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

/**
 * POST /api/friendly/:code/simulate
 * Called by host when both players are ready.
 * Simulates match, streams events via Pusher, awards EXP.
 */
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

  // Distributed lock: prevent double-simulate
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

    // Use deterministic fallback tactics — skips Gemini to avoid 429 quota errors
    // and Vercel function timeout. Match quality is identical; only AI reasoning text differs.
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

    // Stream match events via Pusher (batch in groups of 5 to avoid rate limits)
    const channel = CHANNELS.friendly(code);
    const BATCH = 5;
    for (let i = 0; i < result.events.length; i += BATCH) {
      const batch = result.events.slice(i, i + BATCH);
      await pusher.trigger(channel, EVENTS.MATCH_EVENT, { events: batch });

      // Small delay between batches so frontend can animate
      await new Promise((r) => setTimeout(r, 200));
    }

    // Save match result
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

    // Update lobby status
    await prisma.friendlyMatch.update({
      where: { id: lobby.id },
      data: { status: "COMPLETED" },
    });

    // Award EXP (non-blocking)
    fetch(`${req.headers.get("origin") ?? ""}/api/exp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchResultId: matchResult.id,
        homeTeamId: lobby.hostTeamId,
        awayTeamId: lobby.guestTeam.id,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        events: result.events,
      }),
    }).catch(() => {});

    // Broadcast match end
    await pusher.trigger(channel, EVENTS.MATCH_END, {
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      matchResultId: matchResult.id,
    });

    return NextResponse.json({
      success: true,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
    });
  } finally {
    await redis.del(lockKey);
  }
}
