import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const Schema = z.object({
  formation: z.enum(["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "5-3-2", "4-5-1"]),
  // slotAssignments: array of { playerId, slotIndex } for all 11 starting slots
  slots: z.array(z.object({
    playerId: z.string(),
    slotIndex: z.number().int().min(0).max(10),
  })).max(11),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { formation, slots } = parsed.data;

  const userTeam = await prisma.team.findFirst({ where: { isUserControlled: true } });
  if (!userTeam) return NextResponse.json({ error: "User team not found" }, { status: 400 });

  // Verify all players belong to user squad
  const playerIds = slots.map((s) => s.playerId);
  const ownedPlayers = await prisma.player.findMany({
    where: { id: { in: playerIds }, isInUserSquad: true },
    select: { id: true, position: true },
  });

  if (ownedPlayers.length !== playerIds.length) {
    return NextResponse.json({ error: "Some players not in your squad" }, { status: 400 });
  }

  const gkCount = ownedPlayers.filter((p) => p.position === "GK").length;
  if (gkCount !== 1) {
    return NextResponse.json({ error: `Formation must include exactly 1 GK, got ${gkCount}` }, { status: 400 });
  }

  // Clear existing slots and set new ones
  await prisma.$transaction([
    prisma.userSquad.deleteMany(),
    prisma.userSquad.createMany({
      data: slots.map((s) => ({ playerId: s.playerId, slotIndex: s.slotIndex })),
    }),
    prisma.team.update({
      where: { id: userTeam.id },
      data: { formation },
    }),
  ]);

  return NextResponse.json({ success: true, formation, slotsSet: slots.length });
}
