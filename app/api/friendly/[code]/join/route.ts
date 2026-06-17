import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pusher, CHANNELS, EVENTS } from "@/lib/pusher/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/friendly/:code/join */
export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  const { solanaWallet } = await req.json();
  const session = await prisma.userSession.findUnique({ where: { solanaWallet } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const lobby = await prisma.friendlyMatch.findUnique({
    where: { code: params.code.toUpperCase() },
    include: { hostTeam: { select: { name: true } } },
  });

  if (!lobby) return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
  if (lobby.status !== "WAITING") return NextResponse.json({ error: "Lobby is not available" }, { status: 409 });
  if (lobby.expiresAt < new Date()) return NextResponse.json({ error: "Lobby expired" }, { status: 410 });
  if (lobby.hostTeamId === session.teamId) return NextResponse.json({ error: "Cannot join your own lobby" }, { status: 400 });

  const updated = await prisma.friendlyMatch.update({
    where: { id: lobby.id },
    data: { guestTeamId: session.teamId, status: "READY" },
    include: {
      hostTeam: { select: { id: true, name: true, logoSvg: true, jerseyColor: true } },
      guestTeam: { select: { id: true, name: true, logoSvg: true, jerseyColor: true } },
    },
  });

  await pusher.trigger(CHANNELS.friendly(params.code), EVENTS.GUEST_JOINED, {
    guestTeam: updated.guestTeam,
  });

  return NextResponse.json({ lobby: updated });
}
