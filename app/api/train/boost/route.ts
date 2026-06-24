import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Connection, PublicKey } from "@solana/web3.js";
import { TRAINING_STATS } from "@/lib/exp/manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const TREASURY = process.env.NEXT_PUBLIC_SOLANA_TREASURY ?? "";
const LAMPORTS_PER_SOL = 1_000_000_000;
const BOOST_SOL = 0.01;
const BOOST_MIN = 5;
const BOOST_MAX = 10;

/**
 * POST /api/train/boost
 * Pay 0.01 SOL to treasury, get +5 to +10 stat gain on random stat.
 * Body: { solanaWallet, playerId, txHash }
 */
export async function POST(req: NextRequest) {
  const { solanaWallet, playerId, txHash } = await req.json();

  if (!solanaWallet || !playerId || !txHash) {
    return NextResponse.json({ error: "solanaWallet, playerId, txHash required" }, { status: 400 });
  }

  const session = await prisma.userSession.findUnique({ where: { solanaWallet } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player || player.teamId !== session.teamId) {
    return NextResponse.json({ error: "Player not in your team" }, { status: 403 });
  }

  // Verify SOL payment to treasury
  try {
    const connection = new Connection(RPC, "confirmed");
    const tx = await connection.getTransaction(txHash, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) return NextResponse.json({ error: "Transaction not found. Try again." }, { status: 400 });
    if (tx.meta?.err) return NextResponse.json({ error: "Transaction failed on-chain" }, { status: 400 });

    const expectedLamports = Math.round(BOOST_SOL * LAMPORTS_PER_SOL);
    const treasuryPubkey = new PublicKey(TREASURY);
    const accountKeys = tx.transaction.message.getAccountKeys
      ? tx.transaction.message.getAccountKeys().staticAccountKeys
      : (tx.transaction.message as any).accountKeys as PublicKey[];

    const treasuryIndex = accountKeys.findIndex((k) => k.toBase58() === treasuryPubkey.toBase58());
    if (treasuryIndex === -1) {
      return NextResponse.json({ error: "Payment not sent to correct address" }, { status: 400 });
    }

    const received = tx.meta!.postBalances[treasuryIndex] - tx.meta!.preBalances[treasuryIndex];
    if (received < expectedLamports * 0.99) {
      return NextResponse.json({ error: `Expected ${BOOST_SOL} SOL, received ${(received / LAMPORTS_PER_SOL).toFixed(4)} SOL` }, { status: 400 });
    }
  } catch (err) {
    console.error("[boost] tx verify error:", err);
    return NextResponse.json({ error: "Could not verify transaction" }, { status: 500 });
  }

  // Apply boost — random stat, +5 to +10
  const stat = TRAINING_STATS[Math.floor(Math.random() * TRAINING_STATS.length)];
  const gain = BOOST_MIN + Math.floor(Math.random() * (BOOST_MAX - BOOST_MIN + 1));
  const currentVal = player[stat as keyof typeof player] as number;
  const newVal = Math.min(99, currentVal + gain);
  const actualGain = newVal - currentVal;

  await prisma.$transaction([
    prisma.player.update({
      where: { id: playerId },
      data: { [stat]: newVal },
    }),
    prisma.boostLog.create({
      data: { playerId, wallet: solanaWallet, stat, gain: actualGain, txHash, solPaid: BOOST_SOL },
    }),
    prisma.portalMessage.create({
      data: {
        type: "TRAINING",
        title: `⚡ ${player.name} Power Boosted!`,
        content: `${player.name} received a SOL-powered training boost. ${stat.toUpperCase()} +${actualGain} (now ${newVal}). Cost: ${BOOST_SOL} SOL.`,
        walletAddress: solanaWallet,
      },
    }),
  ]);

  return NextResponse.json({ success: true, stat, gain: actualGain, newValue: newVal });
}
