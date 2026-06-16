import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const team = await prisma.team.findUnique({
    where: { id: params.id },
    include: {
      players: {
        orderBy: [{ position: "asc" }, { name: "asc" }],
      },
    },
  });

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  return NextResponse.json({
    teamId: team.id,
    teamName: team.name,
    isUserControlled: team.isUserControlled,
    players: team.players,
  });
}
