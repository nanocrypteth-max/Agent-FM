import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Connection, PublicKey } from "@solana/web3.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const TREASURY = process.env.NEXT_PUBLIC_SOLANA_TREASURY ?? "";
const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * POST /api/market/buy-sol
 * Backend escrow flow:
 * 1. Buyer sends SOL to treasury wallet (done client-side)
 * 2. Client sends txHash here
 * 3. We verify tx: correct amount sent to treasury from buyer
 * 4. Transfer player + notify seller to claim their SOL
 * 
 * Body: { buyerWallet, listingId, txHash }
 */
export async function POST(req: NextRequest) {
  const { buyerWallet, listingId, txHash } = await req.json();

  if (!buyerWallet || !listingId || !txHash) {
    return NextResponse.json({ error: "buyerWallet, listingId, txHash required" }, { status: 400 });
  }

  const listing = await prisma.transferListing.findUnique({
    where: { id: listingId },
    include: { player: true, fromTeam: true },
  });

  if (!listing || listing.status !== "LISTED") {
    return NextResponse.json({ error: "Listing not found or already sold" }, { status: 404 });
  }

  if (!listing.isSOLListing) {
    return NextResponse.json({ error: "Not a SOL listing" }, { status: 400 });
  }

  const buyerSession = await prisma.userSession.findUnique({ where: { solanaWallet: buyerWallet } });
  if (!buyerSession) return NextResponse.json({ error: "Buyer session not found" }, { status: 404 });

  if (buyerSession.teamId === listing.fromTeamId) {
    return NextResponse.json({ error: "Cannot buy your own listing" }, { status: 400 });
  }

  // Verify transaction on-chain
  try {
    const connection = new Connection(RPC, "confirmed");
    const tx = await connection.getTransaction(txHash, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found on-chain. Wait a moment and retry." }, { status: 400 });
    }

    // Verify: transaction succeeded
    if (tx.meta?.err) {
      return NextResponse.json({ error: "Transaction failed on-chain" }, { status: 400 });
    }

    // Verify: correct amount sent to treasury
    const expectedLamports = Math.round(listing.priceSOL * LAMPORTS_PER_SOL);
    const treasuryPubkey = new PublicKey(TREASURY);
    const accountKeys = tx.transaction.message.getAccountKeys
      ? tx.transaction.message.getAccountKeys().staticAccountKeys
      : (tx.transaction.message as any).accountKeys as PublicKey[];

    const treasuryIndex = accountKeys.findIndex((k) => k.toBase58() === treasuryPubkey.toBase58());
    if (treasuryIndex === -1) {
      return NextResponse.json({ error: "Transaction does not involve treasury wallet" }, { status: 400 });
    }

    const preBalance = tx.meta!.preBalances[treasuryIndex];
    const postBalance = tx.meta!.postBalances[treasuryIndex];
    const received = postBalance - preBalance;

    if (received < expectedLamports * 0.99) { // 1% tolerance for fees
      return NextResponse.json({
        error: `Insufficient payment. Expected ${listing.priceSOL} SOL, received ${received / LAMPORTS_PER_SOL} SOL`,
      }, { status: 400 });
    }
  } catch (err) {
    console.error("[market/buy-sol] tx verification error:", err);
    return NextResponse.json({ error: "Could not verify transaction. Try again." }, { status: 500 });
  }

  // All good — transfer player
  await prisma.$transaction([
    prisma.transferListing.update({
      where: { id: listingId },
      data: { status: "SOLD", soldAt: new Date(), escrowTxHash: txHash },
    }),
    prisma.player.update({
      where: { id: listing.playerId },
      data: { teamId: buyerSession.teamId, isInUserSquad: true },
    }),
    prisma.transferLog.create({
      data: {
        playerId: listing.playerId,
        fromTeamId: listing.fromTeamId,
        toTeamId: buyerSession.teamId,
        price: listing.price,
        priceSOL: listing.priceSOL,
        source: "MARKET",
      },
    }),
    // Notify buyer
    prisma.portalMessage.create({
      data: {
        type: "TRANSFER",
        title: `✅ Transfer Complete: ${listing.player.name} Signed`,
        content: `${listing.player.name} (${listing.player.position} ★${listing.player.starRating}) has joined your squad for ${listing.priceSOL} SOL.`,
        walletAddress: buyerWallet,
        metadata: { playerId: listing.playerId, priceSOL: listing.priceSOL },
      },
    }),
    // Notify seller to claim SOL (in real production, auto-transfer from treasury)
    prisma.portalMessage.create({
      data: {
        type: "TRANSFER",
        title: `💰 ${listing.player.name} Sold for ${listing.priceSOL} SOL`,
        content: `Your player ${listing.player.name} was purchased for ${listing.priceSOL} SOL. The SOL has been credited to the treasury. Contact support to claim: tx ${txHash}`,
        walletAddress: listing.sellerWallet,
        metadata: { txHash, priceSOL: listing.priceSOL, playerId: listing.playerId },
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    player: listing.player.name,
    priceSOL: listing.priceSOL,
  });
}
