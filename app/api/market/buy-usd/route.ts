import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/market/buy-usd — buy player using in-game USD balance */
export async function POST(req: NextRequest) {
  const { buyerWallet, listingId } = await req.json();

  if (!buyerWallet || !listingId) {
    return NextResponse.json({ error: "buyerWallet and listingId required" }, { status: 400 });
  }

  const [listing, buyerSession] = await Promise.all([
    prisma.transferListing.findUnique({
      where: { id: listingId },
      include: { player: true, fromTeam: true },
    }),
    prisma.userSession.findUnique({ where: { solanaWallet: buyerWallet } }),
  ]);

  if (!listing || listing.status !== "LISTED") {
    return NextResponse.json({ error: "Listing not found or sold" }, { status: 404 });
  }
  if (!listing.isUSDListing) {
    return NextResponse.json({ error: "Not a USD listing" }, { status: 400 });
  }
  if (!buyerSession) {
    return NextResponse.json({ error: "Buyer session not found" }, { status: 404 });
  }
  if (buyerSession.teamId === listing.fromTeamId) {
    return NextResponse.json({ error: "Cannot buy your own listing" }, { status: 400 });
  }
  if (buyerSession.usdBalance < listing.priceUSD) {
    return NextResponse.json({
      error: `Insufficient balance. Need $${(listing.priceUSD / 100).toLocaleString()}, have $${(buyerSession.usdBalance / 100).toLocaleString()}`,
    }, { status: 400 });
  }

  // Find seller to credit
  const sellerSession = await prisma.userSession.findUnique({
    where: { solanaWallet: listing.sellerWallet },
  });

  await prisma.$transaction([
    prisma.transferListing.update({
      where: { id: listingId },
      data: { status: "SOLD", soldAt: new Date() },
    }),
    prisma.player.update({
      where: { id: listing.playerId },
      data: { teamId: buyerSession.teamId, isInUserSquad: true },
    }),
    // Deduct from buyer
    prisma.userSession.update({
      where: { id: buyerSession.id },
      data: { usdBalance: { decrement: listing.priceUSD } },
    }),
    // Credit seller
    ...(sellerSession ? [prisma.userSession.update({
      where: { id: sellerSession.id },
      data: { usdBalance: { increment: listing.priceUSD } },
    })] : []),
    prisma.transferLog.create({
      data: {
        playerId: listing.playerId,
        fromTeamId: listing.fromTeamId,
        toTeamId: buyerSession.teamId,
        price: listing.priceUSD / 100,
        source: "MARKET",
      },
    }),
    prisma.portalMessage.create({
      data: {
        type: "TRANSFER",
        title: `✅ Signed: ${listing.player.name}`,
        content: `${listing.player.name} joined your squad for $${(listing.priceUSD / 100).toLocaleString()} in-game USD.`,
        walletAddress: buyerWallet,
      },
    }),
    ...(sellerSession ? [prisma.portalMessage.create({
      data: {
        type: "TRANSFER",
        title: `💵 ${listing.player.name} Sold for $${(listing.priceUSD / 100).toLocaleString()}`,
        content: `${listing.player.name} was sold. $${(listing.priceUSD / 100).toLocaleString()} has been added to your in-game balance.`,
        walletAddress: listing.sellerWallet,
      },
    })] : []),
  ]);

  return NextResponse.json({ success: true, player: listing.player.name });
}
