import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pusher, CHANNELS } from "@/lib/pusher/server";
import { redis } from "@/lib/redis/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/friendly/:code/halftime
 * Called by each player when they confirm half-time tactics.
 * When both confirm (or first player triggers after 60s timeout),
 * fires "second-half-start" Pusher event.
 */
export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  const { solanaWallet, formation } = await req.json();
  const code = params.code.toUpperCase();

  const session = await prisma.userSession.findUnique({ where: { solanaWallet } });
  const lobby = await prisma.friendlyMatch.findUnique({ where: { code } });

  if (!session || !lobby) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isHost  = lobby.hostTeamId  === session.teamId;
  const isGuest = lobby.guestTeamId === session.teamId;
  if (!isHost && !isGuest) return NextResponse.json({ error: "Not in lobby" }, { status: 403 });

  const role = isHost ? "host" : "guest";
  const confirmKey  = `halftime:${lobby.id}:${role}`;
  const bothReadyKey = `halftime:${lobby.id}:both`;

  // Record this player's confirmation (60s TTL — auto-expire = auto-timeout)
  await redis.set(confirmKey, formation ?? "4-4-2", { ex: 60 });

  // Check if other player has confirmed
  const otherRole = isHost ? "guest" : "host";
  const otherKey  = `halftime:${lobby.id}:${otherRole}`;
  const otherConfirmed = await redis.get(otherKey);

  // Notify opponent that this player confirmed
  await pusher.trigger(CHANNELS.friendly(code), "halftime-confirmed", {
    teamId: session.teamId,
    formation: formation ?? "4-4-2",
  });

  // If both confirmed, start second half immediately
  if (otherConfirmed !== null) {
    const alreadyStarted = await redis.get(bothReadyKey);
    if (!alreadyStarted) {
      await redis.set(bothReadyKey, "1", { ex: 60 });
      await pusher.trigger(CHANNELS.friendly(code), "second-half-start", {
        message: "Both teams confirmed tactics — second half starting!",
      });
    }
    return NextResponse.json({ success: true, bothReady: true });
  }

  return NextResponse.json({ success: true, bothReady: false });
}

/**
 * GET /api/friendly/:code/halftime?secret=...
 * Called by client after 60s timeout if opponent hasn't confirmed.
 * Forces second-half-start regardless.
 */
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const lobby = await prisma.friendlyMatch.findUnique({ where: { code } });
  if (!lobby) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bothReadyKey = `halftime:${lobby.id}:both`;
  const alreadyStarted = await redis.get(bothReadyKey);

  if (!alreadyStarted) {
    await redis.set(bothReadyKey, "1", { ex: 60 });
    await pusher.trigger(CHANNELS.friendly(code), "second-half-start", {
      message: "Time's up — second half starting with current tactics!",
    });
  }

  return NextResponse.json({ success: true });
}
