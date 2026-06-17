import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const listingId = params.id;
  const { solanaWallet } = await req.json();

  if (!solanaWallet) {
    return NextResponse.json(
      { error: "solanaWallet required" },
      { status: 400 },
    );
  }

  const listing = await prisma.transferListing.findUnique({
    where: { id: listingId },
    include: { player: true, fromTeam: true },
  });

  if (!listing || listing.status !== "LISTED") {
    return NextResponse.json(
      { error: "Listing not found or already sold" },
      { status: 404 },
    );
  }

  // Find buyer session
  const buyerSession = await prisma.userSession.findUnique({
    where: { solanaWallet },
  });
  if (!buyerSession)
    return NextResponse.json({ error: "Session not found" }, { status: 400 });

  const buyerTeam = await prisma.team.findUnique({
    where: { id: buyerSession.teamId },
  });
  if (!buyerTeam)
    return NextResponse.json({ error: "Team not found" }, { status: 400 });

  if (buyerTeam.id === listing.fromTeamId) {
    return NextResponse.json(
      { error: "Cannot buy your own listing" },
      { status: 400 },
    );
  }

  if (buyerTeam.budget < listing.price) {
    return NextResponse.json(
      {
        error: `Insufficient budget. Need £${listing.price.toLocaleString()}, have £${buyerTeam.budget.toLocaleString()}`,
      },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.transferListing.update({
      where: { id: listingId },
      data: { status: "SOLD", soldAt: new Date() },
    }),
    prisma.player.update({
      where: { id: listing.playerId },
      data: { teamId: buyerTeam.id, isInUserSquad: true },
    }),
    prisma.team.update({
      where: { id: buyerTeam.id },
      data: { budget: { decrement: listing.price } },
    }),
    prisma.team.update({
      where: { id: listing.fromTeamId },
      data: { budget: { increment: listing.price } },
    }),
    prisma.transferLog.create({
      data: {
        playerId: listing.playerId,
        fromTeamId: listing.fromTeamId,
        toTeamId: buyerTeam.id,
        price: listing.price,
        source: "MARKET",
      },
    }),
    prisma.portalMessage.create({
      data: {
        type: "TRANSFER",
        title: `Transfer Complete: ${listing.player.name} Signed`,
        content: `${listing.player.name} (${listing.player.position}, ★${listing.player.starRating}) joined from ${listing.fromTeam.name} for £${listing.price.toLocaleString()}.`,
        walletAddress: solanaWallet,
        metadata: { playerId: listing.playerId, price: listing.price },
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    player: listing.player.name,
    price: listing.price,
    remainingBudget: buyerTeam.budget - listing.price,
  });
}
