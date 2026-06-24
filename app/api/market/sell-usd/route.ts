import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Schema = z.object({
  solanaWallet: z.string(),
  playerId: z.string(),
  priceUSD: z.number().int().positive().max(10_000_000), // max $100,000
});

/** POST /api/market/sell-usd — list player for in-game USD */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { solanaWallet, playerId, priceUSD } = parsed.data;
  const session = await prisma.userSession.findUnique({ where: { solanaWallet } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player || player.teamId !== session.teamId) {
    return NextResponse.json({ error: "Player not in your team" }, { status: 403 });
  }

  await prisma.transferListing.updateMany({
    where: { playerId, status: "LISTED" },
    data: { status: "CANCELLED" },
  });

  const listing = await prisma.transferListing.upsert({
    where: { playerId },
    create: {
      playerId,
      fromTeamId: session.teamId,
      sellerWallet: solanaWallet,
      price: priceUSD,
      priceUSD: priceUSD * 100, // store as cents
      priceSOL: 0,
      isUSDListing: true,
      isSOLListing: false,
      status: "LISTED",
    },
    update: {
      priceUSD: priceUSD * 100,
      price: priceUSD,
      sellerWallet: solanaWallet,
      isUSDListing: true,
      isSOLListing: false,
      status: "LISTED",
      listedAt: new Date(),
      soldAt: null,
    },
  });

  return NextResponse.json({ listing });
}
