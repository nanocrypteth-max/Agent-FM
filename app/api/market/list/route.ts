import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const Schema = z.object({
  playerId: z.string(),
  price: z.number().int().positive(),
});

// User lists their own player on the market
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { playerId, price } = parsed.data;

  const userTeam = await prisma.team.findFirst({ where: { isUserControlled: true } });
  if (!userTeam) return NextResponse.json({ error: "User team not found" }, { status: 400 });

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player || player.teamId !== userTeam.id) {
    return NextResponse.json({ error: "Player not in your squad" }, { status: 403 });
  }

  // Check not already listed
  const existing = await prisma.transferListing.findUnique({
    where: { playerId },
  });
  if (existing && existing.status === "LISTED") {
    return NextResponse.json({ error: "Player already listed" }, { status: 409 });
  }

  const listing = await prisma.transferListing.upsert({
    where: { playerId },
    create: { playerId, fromTeamId: userTeam.id, price, status: "LISTED" },
    update: { price, status: "LISTED", listedAt: new Date(), soldAt: null },
  });

  // Portal notification
  await prisma.portalMessage.create({
    data: {
      type: "TRANSFER",
      title: `${player.name} Listed for Transfer`,
      content: `You have listed ${player.name} (${player.position}, ★${player.starRating}) on the transfer market for £${price.toLocaleString()}.`,
    },
  });

  return NextResponse.json({ listing });
}

// Cancel listing
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get("playerId");
  if (!playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 });

  await prisma.transferListing.updateMany({
    where: { playerId, status: "LISTED" },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({ success: true });
}
