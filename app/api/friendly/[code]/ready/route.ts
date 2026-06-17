import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pusher, CHANNELS, EVENTS } from "@/lib/pusher/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/friendly/:code/ready */
export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  const { solanaWallet } = await req.json();
  const session = await prisma.userSession.findUnique({ where: { solanaWallet } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const lobby = await prisma.friendlyMatch.findUnique({ where: { code: params.code.toUpperCase() } });
  if (!lobby || lobby.status === "COMPLETED") {
    return NextResponse.json({ error: "Lobby not available" }, { status: 404 });
  }

  const isHost = lobby.hostTeamId === session.teamId;
  const isGuest = lobby.guestTeamId === session.teamId;
  if (!isHost && !isGuest) return NextResponse.json({ error: "Not in this lobby" }, { status: 403 });

  const updated = await prisma.friendlyMatch.update({
    where: { id: lobby.id },
    data: {
      hostReady: isHost ? true : lobby.hostReady,
      guestReady: isGuest ? true : lobby.guestReady,
    },
  });

  const event = isHost ? EVENTS.HOST_READY : EVENTS.GUEST_READY;
  await pusher.trigger(CHANNELS.friendly(params.code), event, {});

  // Both ready → trigger match start signal
  if (updated.hostReady && updated.guestReady) {
    await prisma.friendlyMatch.update({ where: { id: lobby.id }, data: { status: "PLAYING" } });
    await pusher.trigger(CHANNELS.friendly(params.code), EVENTS.MATCH_START, {
      friendlyId: lobby.id,
    });
  }

  return NextResponse.json({ ready: true, bothReady: updated.hostReady && updated.guestReady });
}
