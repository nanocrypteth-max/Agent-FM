import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Get user's full squad (all owned players)
export async function GET() {
  const userTeam = await prisma.team.findFirst({
    where: { isUserControlled: true },
    select: { id: true, name: true, budget: true, jerseyColor: true, logoSvg: true, formation: true },
  });
  if (!userTeam) return NextResponse.json({ error: "User team not found" }, { status: 404 });

  const players = await prisma.player.findMany({
    where: { isInUserSquad: true },
    include: { team: { select: { name: true } } },
    orderBy: [{ starRating: "desc" }, { position: "asc" }],
  });

  const squadSlots = await prisma.userSquad.findMany();
  const slotMap = new Map(squadSlots.map((s) => [s.playerId, s.slotIndex]));

  return NextResponse.json({
    team: userTeam,
    players: players.map((p) => ({
      ...p,
      slotIndex: slotMap.get(p.id) ?? null,
    })),
    totalPlayers: players.length,
    startingXI: players.filter((p) => slotMap.get(p.id) !== undefined && slotMap.get(p.id) !== null).length,
  });
}
