import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Force dynamic rendering — this route queries the DB
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const listingId = params.id;

  const listing = await prisma.transferListing.findUnique({
    where: { id: listingId },
    include: {
      player: true,
      fromTeam: true,
    },
  });

  if (!listing || listing.status !== "LISTED") {
    return NextResponse.json(
      { error: "Listing not found or already sold" },
      { status: 404 },
    );
  }

  // Find user team
  const userTeam = await prisma.team.findFirst({
    where: { isUserControlled: true },
  });
  if (!userTeam)
    return NextResponse.json({ error: "User team not found" }, { status: 400 });

  if (userTeam.budget < listing.price) {
    return NextResponse.json(
      {
        error: `Insufficient budget. Need £${listing.price.toLocaleString()}, have £${userTeam.budget.toLocaleString()}`,
      },
      { status: 400 },
    );
  }

  // Transaction: buy player
  await prisma.$transaction([
    // Mark listing as sold
    prisma.transferListing.update({
      where: { id: listingId },
      data: { status: "SOLD", soldAt: new Date() },
    }),
    // Move player to user team
    prisma.player.update({
      where: { id: listing.playerId },
      data: { teamId: userTeam.id, isInUserSquad: true },
    }),
    // Deduct budget from user
    prisma.team.update({
      where: { id: userTeam.id },
      data: { budget: { decrement: listing.price } },
    }),
    // Credit selling team
    prisma.team.update({
      where: { id: listing.fromTeamId },
      data: { budget: { increment: listing.price } },
    }),
    // Log transfer
    prisma.transferLog.create({
      data: {
        playerId: listing.playerId,
        fromTeamId: listing.fromTeamId,
        toTeamId: userTeam.id,
        price: listing.price,
        source: "MARKET",
      },
    }),
    // Portal notification
    prisma.portalMessage.create({
      data: {
        type: "TRANSFER",
        title: `Transfer Complete: ${listing.player.name} Signed`,
        content: `${listing.player.name} (${listing.player.position}, ★${listing.player.starRating}) has joined ${userTeam.name} from ${listing.fromTeam.name} for £${listing.price.toLocaleString()}.`,
        metadata: {
          playerId: listing.playerId,
          playerName: listing.player.name,
          price: listing.price,
          fromTeam: listing.fromTeam.name,
          toTeam: userTeam.name,
        },
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    player: listing.player.name,
    price: listing.price,
    remainingBudget: userTeam.budget - listing.price,
  });
}
