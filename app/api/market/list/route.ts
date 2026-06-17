import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Schema = z.object({
  solanaWallet: z.string(),
  playerId: z.string(),
  price: z.number().int().positive(),
});

// User lists their own player on the market (in-game currency listing)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { solanaWallet, playerId, price } = parsed.data;

  const session = await prisma.userSession.findUnique({
    where: { solanaWallet },
  });
  if (!session)
    return NextResponse.json({ error: "Session not found" }, { status: 400 });

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player || player.teamId !== session.teamId) {
    return NextResponse.json(
      { error: "Player not in your squad" },
      { status: 403 },
    );
  }

  const existing = await prisma.transferListing.findUnique({
    where: { playerId },
  });
  if (existing && existing.status === "LISTED") {
    return NextResponse.json(
      { error: "Player already listed" },
      { status: 409 },
    );
  }

  const listing = await prisma.transferListing.upsert({
    where: { playerId },
    create: {
      playerId,
      fromTeamId: session.teamId,
      sellerWallet: solanaWallet,
      price,
      priceSOL: 0,
      isSOLListing: false,
      status: "LISTED",
    },
    update: {
      price,
      sellerWallet: solanaWallet,
      status: "LISTED",
      listedAt: new Date(),
      soldAt: null,
    },
  });

  await prisma.portalMessage.create({
    data: {
      type: "TRANSFER",
      title: `${player.name} Listed for Transfer`,
      content: `You listed ${player.name} (${player.position}, ★${player.starRating}) for £${price.toLocaleString()}.`,
      walletAddress: solanaWallet,
    },
  });

  return NextResponse.json({ listing });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get("playerId");
  if (!playerId)
    return NextResponse.json({ error: "playerId required" }, { status: 400 });

  await prisma.transferListing.updateMany({
    where: { playerId, status: "LISTED" },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({ success: true });
}
