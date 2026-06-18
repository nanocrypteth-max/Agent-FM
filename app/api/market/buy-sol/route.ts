import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Connection, PublicKey } from "@solana/web3.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * POST /api/market/buy-sol
 * Direct P2P flow — SOL goes straight to seller wallet:
 * 1. Client sends SOL directly to sellerWallet (not treasury)
 * 2. Client sends txHash here for verification
 * 3. We verify tx: correct amount sent to seller from buyer
 * 4. Transfer player to buyer
 *
 * Body: { buyerWallet, listingId, txHash }
 */
export async function POST(req: NextRequest) {
  const { buyerWallet, listingId, txHash } = await req.json();

  if (!buyerWallet || !listingId || !txHash) {
    return NextResponse.json(
      { error: "buyerWallet, listingId, txHash required" },
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

  if (!listing.isSOLListing || !listing.sellerWallet) {
    return NextResponse.json(
      { error: "Not a valid SOL listing" },
      { status: 400 },
    );
  }

  const buyerSession = await prisma.userSession.findUnique({
    where: { solanaWallet: buyerWallet },
  });
  if (!buyerSession)
    return NextResponse.json(
      { error: "Buyer session not found" },
      { status: 404 },
    );

  if (buyerSession.teamId === listing.fromTeamId) {
    return NextResponse.json(
      { error: "Cannot buy your own listing" },
      { status: 400 },
    );
  }

  // Verify transaction on-chain — SOL must go to SELLER wallet directly
  try {
    const connection = new Connection(RPC, "confirmed");
    const tx = await connection.getTransaction(txHash, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return NextResponse.json(
        {
          error: "Transaction not found on-chain. Wait a moment and retry.",
        },
        { status: 400 },
      );
    }

    if (tx.meta?.err) {
      return NextResponse.json(
        { error: "Transaction failed on-chain" },
        { status: 400 },
      );
    }

    // Verify SOL went to seller wallet
    const expectedLamports = Math.round(listing.priceSOL * LAMPORTS_PER_SOL);
    const sellerPubkey = new PublicKey(listing.sellerWallet);

    const accountKeys = tx.transaction.message.getAccountKeys
      ? tx.transaction.message.getAccountKeys().staticAccountKeys
      : ((tx.transaction.message as any).accountKeys as PublicKey[]);

    const sellerIndex = accountKeys.findIndex(
      (k) => k.toBase58() === sellerPubkey.toBase58(),
    );

    if (sellerIndex === -1) {
      return NextResponse.json(
        {
          error: "Transaction does not send SOL to seller wallet",
        },
        { status: 400 },
      );
    }

    const preBalance = tx.meta!.preBalances[sellerIndex];
    const postBalance = tx.meta!.postBalances[sellerIndex];
    const received = postBalance - preBalance;

    // Allow 1% tolerance for fees
    if (received < expectedLamports * 0.99) {
      return NextResponse.json(
        {
          error: `Insufficient payment. Expected ${listing.priceSOL} SOL, received ${(received / LAMPORTS_PER_SOL).toFixed(4)} SOL`,
        },
        { status: 400 },
      );
    }
  } catch (err) {
    console.error("[market/buy-sol] tx verification error:", err);
    return NextResponse.json(
      { error: "Could not verify transaction. Try again." },
      { status: 500 },
    );
  }

  // Transfer player to buyer
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
        title: `✅ Signed: ${listing.player.name}`,
        content: `${listing.player.name} (${listing.player.position} ★${listing.player.starRating}) joined your squad for ${listing.priceSOL} SOL. The SOL was sent directly to the seller's wallet.`,
        walletAddress: buyerWallet,
        metadata: {
          playerId: listing.playerId,
          priceSOL: listing.priceSOL,
          txHash,
        },
      },
    }),
    // Notify seller — SOL already in their wallet
    prisma.portalMessage.create({
      data: {
        type: "TRANSFER",
        title: `💰 ${listing.player.name} Sold for ${listing.priceSOL} SOL`,
        content: `Your player ${listing.player.name} was purchased for ${listing.priceSOL} SOL. The SOL has been sent directly to your wallet. Tx: ${txHash.slice(0, 16)}...`,
        walletAddress: listing.sellerWallet,
        metadata: {
          txHash,
          priceSOL: listing.priceSOL,
          playerId: listing.playerId,
        },
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    player: listing.player.name,
    priceSOL: listing.priceSOL,
  });
}
