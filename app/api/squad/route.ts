import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Force dynamic rendering — this route queries the DB
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Get user's full squad (all owned players)
export async function GET(req: NextRequest) {
  const wallet = new URL(req.url).searchParams.get("wallet");

  let teamId: string | null = null;

  if (wallet) {
    const session = await prisma.userSession.findUnique({
      where: { solanaWallet: wallet },
    });
    teamId = session?.teamId ?? null;
  }

  if (!teamId) {
    return NextResponse.json(
      { error: "wallet param required" },
      { status: 400 },
    );
  }

  const userTeam = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      budget: true,
      jerseyColor: true,
      logoSvg: true,
      formation: true,
    },
  });
  if (!userTeam)
    return NextResponse.json({ error: "User team not found" }, { status: 404 });

  const players = await prisma.player.findMany({
    where: { teamId },
    include: { team: { select: { name: true } } },
    orderBy: [{ starRating: "desc" }, { position: "asc" }],
  });

  const squadSlots = await prisma.userSquad.findMany({
    where: { playerId: { in: players.map((p) => p.id) } },
  });
  const slotMap = new Map(squadSlots.map((s) => [s.playerId, s.slotIndex]));

  return NextResponse.json({
    team: userTeam,
    players: players.map((p) => ({
      ...p,
      slotIndex: slotMap.get(p.id) ?? null,
    })),
    totalPlayers: players.length,
    startingXI: players.filter(
      (p) => slotMap.get(p.id) !== undefined && slotMap.get(p.id) !== null,
    ).length,
  });
}
