import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pusher, CHANNELS, EVENTS } from "@/lib/pusher/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/friendly/:code/lineup
 * Broadcast to channel that this player confirmed their lineup.
 * Body: { solanaWallet, formation, playerIds }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } },
) {
  const { solanaWallet, formation, playerIds } = await req.json();
  const code = params.code.toUpperCase();

  const session = await prisma.userSession.findUnique({
    where: { solanaWallet },
  });
  const lobby = await prisma.friendlyMatch.findUnique({
    where: { code },
    include: {
      hostTeam: { select: { name: true } },
      guestTeam: { select: { name: true } },
    },
  });

  if (!session || !lobby)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isHost = lobby.hostTeamId === session.teamId;
  const isGuest = lobby.guestTeamId === session.teamId;
  if (!isHost && !isGuest)
    return NextResponse.json({ error: "Not in lobby" }, { status: 403 });

  // Broadcast lineup confirmed to both players
  await pusher.trigger(CHANNELS.friendly(code), EVENTS.LINEUP_CONFIRMED, {
    teamId: session.teamId,
    teamName: isHost ? lobby.hostTeam.name : lobby.guestTeam?.name,
    isHost,
    formation,
    playerCount: playerIds?.length ?? 0,
  });

  return NextResponse.json({ success: true });
}
