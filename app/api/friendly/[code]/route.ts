import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pusher, CHANNELS, EVENTS } from "@/lib/pusher/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/friendly/:code — Lobby detail */
export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const lobby = await prisma.friendlyMatch.findUnique({
    where: { code: params.code.toUpperCase() },
    include: {
      hostTeam: { select: { id: true, name: true, logoSvg: true, jerseyColor: true } },
      guestTeam: { select: { id: true, name: true, logoSvg: true, jerseyColor: true } },
      matchResult: true,
    },
  });

  if (!lobby) return NextResponse.json({ error: "Lobby not found" }, { status: 404 });

  if (lobby.status === "WAITING" && lobby.expiresAt < new Date()) {
    await prisma.friendlyMatch.update({ where: { id: lobby.id }, data: { status: "EXPIRED" } });
    await pusher.trigger(CHANNELS.friendly(params.code), EVENTS.LOBBY_EXPIRED, {});
    return NextResponse.json({ error: "Lobby has expired" }, { status: 410 });
  }

  return NextResponse.json({ lobby });
}

/** DELETE /api/friendly/:code — Cancel lobby (host only) */
export async function DELETE(req: NextRequest, { params }: { params: { code: string } }) {
  const { solanaWallet } = await req.json();
  const session = await prisma.userSession.findUnique({ where: { solanaWallet } });
  const lobby = await prisma.friendlyMatch.findUnique({ where: { code: params.code.toUpperCase() } });

  if (!lobby || !session || lobby.hostTeamId !== session.teamId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await prisma.friendlyMatch.update({ where: { id: lobby.id }, data: { status: "CANCELLED" } });
  await pusher.trigger(CHANNELS.friendly(params.code), EVENTS.LOBBY_CANCELLED, {});

  return NextResponse.json({ success: true });
}
