import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Connection, PublicKey } from "@solana/web3.js";
import { generatePlayer } from "@/lib/team-generator/generateTeam";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const TREASURY = process.env.NEXT_PUBLIC_SOLANA_TREASURY ?? "";
const LAMPORTS = 1_000_000_000;

const STAR_PRICES: Record<number, number> = { 3: 0.05, 4: 0.1, 5: 0.2 };

/** GET /api/store — list available store players */
export async function GET() {
  const players = await prisma.storePlayer.findMany({
    where: { available: true },
    orderBy: [{ starRating: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ players });
}

/** POST /api/store/buy — buy a store player with SOL */
export async function POST(req: NextRequest) {
  const { solanaWallet, storePlayerId, txHash } = await req.json();
  if (!solanaWallet || !storePlayerId || !txHash) {
    return NextResponse.json({ error: "solanaWallet, storePlayerId, txHash required" }, { status: 400 });
  }

  const session = await prisma.userSession.findUnique({ where: { solanaWallet } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const storePlayer = await prisma.storePlayer.findUnique({ where: { id: storePlayerId } });
  if (!storePlayer || !storePlayer.available) {
    return NextResponse.json({ error: "Player not available" }, { status: 404 });
  }

  const expectedSol = STAR_PRICES[storePlayer.starRating];
  if (!expectedSol) return NextResponse.json({ error: "Invalid star rating" }, { status: 400 });

  // Verify SOL payment
  try {
    const connection = new Connection(RPC, "confirmed");
    const tx = await connection.getTransaction(txHash, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (!tx || tx.meta?.err) return NextResponse.json({ error: "Transaction invalid" }, { status: 400 });

    const accountKeys = tx.transaction.message.getAccountKeys
      ? tx.transaction.message.getAccountKeys().staticAccountKeys
      : (tx.transaction.message as any).accountKeys as PublicKey[];
    const tIdx = accountKeys.findIndex((k) => k.toBase58() === TREASURY);
    if (tIdx === -1) return NextResponse.json({ error: "Payment not to treasury" }, { status: 400 });

    const received = tx.meta!.postBalances[tIdx] - tx.meta!.preBalances[tIdx];
    if (received < Math.round(expectedSol * LAMPORTS * 0.99)) {
      return NextResponse.json({ error: `Expected ${expectedSol} SOL` }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Could not verify transaction" }, { status: 500 });
  }

  // Add player to user's team
  await prisma.$transaction([
    prisma.player.create({
      data: {
        name: storePlayer.name,
        position: storePlayer.position as any,
        age: storePlayer.age,
        nationality: storePlayer.nationality,
        starRating: storePlayer.starRating,
        pace: storePlayer.pace,
        shooting: storePlayer.shooting,
        passing: storePlayer.passing,
        defending: storePlayer.defending,
        stamina: storePlayer.stamina,
        fitness: 100, morale: 80,
        marketValue: storePlayer.starRating * 1_000_000,
        teamId: session.teamId,
        isInUserSquad: true,
        avatarSvg: storePlayer.avatarSvg ?? "",
      },
    }),
    // Restock with a new player of same rating
    prisma.storePlayer.update({ where: { id: storePlayerId }, data: { available: false } }),
    prisma.portalMessage.create({
      data: {
        type: "TRANSFER",
        title: `🌟 Signed: ${storePlayer.name} (${storePlayer.starRating}★)`,
        content: `${storePlayer.name} joined your squad from the game store for ${expectedSol} SOL.`,
        walletAddress: solanaWallet,
      },
    }),
  ]);

  return NextResponse.json({ success: true, playerName: storePlayer.name });
}
