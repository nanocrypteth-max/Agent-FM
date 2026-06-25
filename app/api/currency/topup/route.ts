import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Connection, PublicKey } from "@solana/web3.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const TREASURY = process.env.NEXT_PUBLIC_SOLANA_TREASURY ?? "";
const LAMPORTS_PER_SOL = 1_000_000_000;
const USD_PER_SOL = 10000; // 1 SOL = $10,000
const CENTS_PER_USD = 100;

/**
 * POST /api/currency/topup
 * Pay SOL to treasury, receive USD in-game balance.
 * Rate: 1 SOL = $10,000
 * Body: { solanaWallet, solAmount, txHash }
 */
export async function POST(req: NextRequest) {
  const { solanaWallet, solAmount, txHash } = await req.json();

  if (!solanaWallet || !solAmount || !txHash) {
    return NextResponse.json(
      { error: "solanaWallet, solAmount, txHash required" },
      { status: 400 },
    );
  }

  const session = await prisma.userSession.findUnique({
    where: { solanaWallet },
  });
  if (!session)
    return NextResponse.json({ error: "Session not found" }, { status: 404 });

  // Verify SOL tx
  try {
    const connection = new Connection(RPC, "confirmed");
    const tx = await connection.getTransaction(txHash, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      console.error("[topup] tx not found:", txHash);
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 400 },
      );
    }
    if (tx.meta?.err) {
      console.error("[topup] tx failed on-chain:", tx.meta.err);
      return NextResponse.json(
        { error: "Transaction failed on-chain" },
        { status: 400 },
      );
    }

    const expectedLamports = Math.round(solAmount * LAMPORTS_PER_SOL);
    const treasuryPubkey = new PublicKey(TREASURY);
    const accountKeys = tx.transaction.message.getAccountKeys
      ? tx.transaction.message.getAccountKeys().staticAccountKeys
      : ((tx.transaction.message as any).accountKeys as PublicKey[]);

    console.log("[topup] treasury env:", TREASURY);
    console.log(
      "[topup] accountKeys:",
      accountKeys.map((k: PublicKey) => k.toBase58()),
    );

    const treasuryIndex = accountKeys.findIndex(
      (k: PublicKey) => k.toBase58() === treasuryPubkey.toBase58(),
    );
    if (treasuryIndex === -1) {
      console.error(
        "[topup] treasury not in tx. Expected:",
        treasuryPubkey.toBase58(),
      );
      return NextResponse.json(
        { error: "Payment not sent to treasury" },
        { status: 400 },
      );
    }

    const received =
      tx.meta!.postBalances[treasuryIndex] -
      tx.meta!.preBalances[treasuryIndex];
    console.log(
      "[topup] received lamports:",
      received,
      "expected:",
      expectedLamports,
    );
    if (received < expectedLamports * 0.99) {
      return NextResponse.json(
        { error: `Insufficient payment` },
        { status: 400 },
      );
    }
  } catch (err) {
    console.error("[topup] verify error:", err);
    return NextResponse.json(
      { error: "Could not verify transaction" },
      { status: 500 },
    );
  }

  const usdEarnedCents = Math.round(solAmount * USD_PER_SOL * CENTS_PER_USD);

  await prisma.$transaction([
    prisma.userSession.update({
      where: { solanaWallet },
      data: { usdBalance: { increment: usdEarnedCents } },
    }),
    prisma.portalMessage.create({
      data: {
        type: "SYSTEM",
        title: `💵 Topup Successful: $${(usdEarnedCents / 100).toLocaleString()}`,
        content: `You topped up $${(usdEarnedCents / 100).toLocaleString()} in-game USD. Rate: 1 SOL = $${USD_PER_SOL.toLocaleString()}. SOL paid: ${solAmount}. Tx: ${txHash.slice(0, 16)}...`,
        walletAddress: solanaWallet,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    usdAdded: usdEarnedCents / 100,
    newBalance: (session.usdBalance + usdEarnedCents) / 100,
  });
}
