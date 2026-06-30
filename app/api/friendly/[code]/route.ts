import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pusher, CHANNELS, EVENTS } from "@/lib/pusher/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/friendly/:code — Lobby detail */
export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } },
) {
  const lobby = await prisma.friendlyMatch.findUnique({
    where: { code: params.code.toUpperCase() },
    include: {
      hostTeam: {
        select: { id: true, name: true, logoSvg: true, jerseyColor: true },
      },
      guestTeam: {
        select: { id: true, name: true, logoSvg: true, jerseyColor: true },
      },
      matchResult: true,
    },
  });

  if (!lobby)
    return NextResponse.json({ error: "Lobby not found" }, { status: 404 });

  if (lobby.status === "WAITING" && lobby.expiresAt < new Date()) {
    await prisma.friendlyMatch.update({
      where: { id: lobby.id },
      data: { status: "EXPIRED" },
    });
    await pusher.trigger(
      CHANNELS.friendly(params.code),
      EVENTS.LOBBY_EXPIRED,
      {},
    );
    return NextResponse.json({ error: "Lobby has expired" }, { status: 410 });
  }

  return NextResponse.json({ lobby });
}

/** DELETE /api/friendly/:code — Cancel lobby (host only) */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { code: string } },
) {
  const { solanaWallet } = await req.json();
  const session = await prisma.userSession.findUnique({
    where: { solanaWallet },
  });
  const lobby = await prisma.friendlyMatch.findUnique({
    where: { code: params.code.toUpperCase() },
  });

  const isHost = lobby && session && lobby.hostTeamId === session.teamId;
  const isGuest = lobby && session && lobby.guestTeamId === session.teamId;
  if (!lobby || !session || (!isHost && !isGuest)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await prisma.friendlyMatch.update({
    where: { id: lobby.id },
    data: { status: "CANCELLED" },
  });
  await pusher.trigger(CHANNELS.friendly(params.code), EVENTS.LOBBY_CANCELLED, {
    cancelledBy: session.teamId,
  });

  return NextResponse.json({ success: true });
}

/** PATCH /api/friendly/:code — Surrender during active match */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { code: string } },
) {
  const { solanaWallet, action } = await req.json();
  if (action !== "surrender")
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const session = await prisma.userSession.findUnique({
    where: { solanaWallet },
  });
  const lobby = await prisma.friendlyMatch.findUnique({
    where: { code: params.code.toUpperCase() },
    include: {
      hostTeam: { select: { id: true, name: true } },
      guestTeam: { select: { id: true, name: true } },
    },
  });

  if (!lobby || !session)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isHost = lobby.hostTeamId === session.teamId;
  const isGuest = lobby.guestTeamId === session.teamId;
  if (!isHost && !isGuest)
    return NextResponse.json({ error: "Not in this lobby" }, { status: 403 });

  // Record surrender — mark lobby completed, notify opponent via Pusher
  await prisma.friendlyMatch.update({
    where: { id: lobby.id },
    data: { status: "COMPLETED" },
  });

  // Award EXP to winner (the one who didn't surrender)
  const winnerTeamId = isHost ? lobby.guestTeamId : lobby.hostTeamId;
  const loserTeamId = isHost ? lobby.hostTeamId : lobby.guestTeamId;

  const [winnerSession, loserSession] = await Promise.all([
    winnerTeamId
      ? prisma.userSession.findUnique({
          where: { teamId: winnerTeamId as string },
        })
      : null,
    prisma.userSession.findUnique({ where: { teamId: loserTeamId as string } }),
  ]);

  const updates = [];
  if (winnerSession) {
    updates.push(
      prisma.userSession.update({
        where: { id: winnerSession.id },
        data: { managerExp: { increment: 25 } },
      }),
    );
    updates.push(
      prisma.portalMessage.create({
        data: {
          type: "FRIENDLY",
          title: "🏆 Opponent Surrendered — You Win!",
          content: `Your opponent surrendered during the friendly match. You have been awarded the win and +25 EXP.`,
          walletAddress: winnerSession.solanaWallet,
        },
      }),
    );
  }
  if (loserSession) {
    updates.push(
      prisma.portalMessage.create({
        data: {
          type: "FRIENDLY",
          title: "🏳️ You Surrendered",
          content: `You left the friendly match early. Your opponent has been awarded the win.`,
          walletAddress: loserSession.solanaWallet,
        },
      }),
    );
  }
  await Promise.all(updates);

  // Notify opponent in real-time
  await pusher.trigger(CHANNELS.friendly(params.code), "opponent-surrendered", {
    surrenderedTeamId: session.teamId,
    winnerTeamId,
  });

  return NextResponse.json({ success: true });
}
