import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canTrainToday, markTrained } from "@/lib/redis/training";
import { trainingGainRange, TRAINING_STATS } from "@/lib/exp/manager";
import { playerLevelFromExp, STARTER_EXP_GAIN } from "@/lib/exp/player";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/train
 * Body: { solanaWallet, playerId }
 * 1 training session per club per day.
 * Manager picks which player to train — that uses up the daily slot.
 */
export async function POST(req: NextRequest) {
  const { solanaWallet, playerId } = await req.json();

  if (!solanaWallet || !playerId) {
    return NextResponse.json(
      { error: "solanaWallet and playerId required" },
      { status: 400 },
    );
  }

  const session = await prisma.userSession.findUnique({
    where: { solanaWallet },
  });
  if (!session)
    return NextResponse.json({ error: "Session not found" }, { status: 404 });

  // Check club training cooldown (1 per day per club)
  const available = await canTrainToday(session.teamId);
  if (!available) {
    return NextResponse.json(
      {
        error: "Your club has already trained today. Come back tomorrow!",
        nextAvailableAt: getNextMidnightUTC(),
      },
      { status: 429 },
    );
  }

  // Verify player belongs to this team
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player || player.teamId !== session.teamId) {
    return NextResponse.json(
      { error: "Player does not belong to your team" },
      { status: 403 },
    );
  }

  // Calculate stat gain based on manager level
  const { min, max } = trainingGainRange(session.managerLevel);
  const gain = min + Math.floor(Math.random() * (max - min + 1));
  const stat =
    TRAINING_STATS[Math.floor(Math.random() * TRAINING_STATS.length)];
  const currentVal = player[stat as keyof typeof player] as number;
  const newVal = Math.min(99, currentVal + gain);
  const actualGain = newVal - currentVal;

  const today = new Date().toISOString().slice(0, 10);
  const newPlayerExp = player.playerExp + STARTER_EXP_GAIN;
  const newPlayerLevel = playerLevelFromExp(newPlayerExp);

  await prisma.$transaction([
    prisma.player.update({
      where: { id: playerId },
      data: {
        [stat]: newVal,
        playerExp: newPlayerExp,
        playerLevel: newPlayerLevel,
      },
    }),
    prisma.trainingLog.create({
      data: { playerId, date: today, statGained: stat, amount: actualGain },
    }),
    prisma.portalMessage.create({
      data: {
        type: "TRAINING",
        title: `${player.name} Completed Training`,
        content: `${player.name} trained hard today. ${stat.toUpperCase()} ${actualGain > 0 ? `+${actualGain} (now ${newVal})` : "already maxed at 99"}. Player EXP: ${newPlayerExp}. Your club's daily training slot has been used.`,
        walletAddress: solanaWallet,
      },
    }),
  ]);

  // Mark club as trained today (uses up daily slot)
  await markTrained(session.teamId);

  return NextResponse.json({
    success: true,
    stat,
    gain: actualGain,
    newValue: newVal,
    playerExp: newPlayerExp,
    playerLevel: newPlayerLevel,
  });
}

/**
 * GET /api/train?wallet=<address>
 * Returns training status for the club + all players.
 */
export async function GET(req: NextRequest) {
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet)
    return NextResponse.json({ error: "wallet required" }, { status: 400 });

  const session = await prisma.userSession.findUnique({
    where: { solanaWallet: wallet },
  });
  if (!session)
    return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const players = await prisma.player.findMany({
    where: { teamId: session.teamId },
    select: {
      id: true,
      name: true,
      position: true,
      starRating: true,
      pace: true,
      shooting: true,
      passing: true,
      defending: true,
      stamina: true,
      playerExp: true,
      playerLevel: true,
      avatarSvg: true,
    },
    orderBy: [{ starRating: "desc" }, { position: "asc" }],
  });

  // Check club-level cooldown (single check, not per-player)
  const clubCanTrain = await canTrainToday(session.teamId);

  return NextResponse.json({
    managerLevel: session.managerLevel,
    managerExp: session.managerExp,
    clubCanTrainToday: clubCanTrain,
    nextResetAt: getNextMidnightUTC(),
    players,
  });
}

function getNextMidnightUTC(): string {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}
