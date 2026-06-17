import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Connection, PublicKey } from "@solana/web3.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Schema = z.object({
  solanaWallet: z.string(),
  playerId: z.string(),
  priceSOL: z.number().positive().max(100), // max 100 SOL per player
});

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

/**
 * POST /api/market/sell
 * List a player for SOL. Seller sets their own price.
 * No escrow needed for listing — only verified on purchase.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { solanaWallet, playerId, priceSOL } = parsed.data;

  const session = await prisma.userSession.findUnique({ where: { solanaWallet } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player || player.teamId !== session.teamId) {
    return NextResponse.json({ error: "Player not in your team" }, { status: 403 });
  }

  // Cancel any existing listing
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
      price: Math.round(priceSOL * 1000), // store as mSOL integer
      priceSOL,
      isSOLListing: true,
      status: "LISTED",
    },
    update: {
      priceSOL,
      price: Math.round(priceSOL * 1000),
      sellerWallet: solanaWallet,
      isSOLListing: true,
      status: "LISTED",
      listedAt: new Date(),
      soldAt: null,
    },
  });

  await prisma.portalMessage.create({
    data: {
      type: "TRANSFER",
      title: `${player.name} Listed for ${priceSOL} SOL`,
      content: `You listed ${player.name} on the SOL transfer market for ${priceSOL} SOL. Other managers can now purchase them.`,
      walletAddress: solanaWallet,
    },
  });

  return NextResponse.json({ listing });
}
