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
 * Train a player: random stat gain based on manager level.
 * Limited to 1 session per player per day (Redis cooldown).
 */
export async function POST(req: NextRequest) {
  const { solanaWallet, playerId } = await req.json();

  if (!solanaWallet || !playerId) {
    return NextResponse.json({ error: "solanaWallet and playerId required" }, { status: 400 });
  }

  // Get manager session
  const session = await prisma.userSession.findUnique({ where: { solanaWallet } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  // Get player and verify ownership
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { team: true },
  });
  if (!player || player.team.leagueId === null) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
  if (player.teamId !== session.teamId) {
    return NextResponse.json({ error: "Player does not belong to your team" }, { status: 403 });
  }

  // Check Redis cooldown
  const available = await canTrainToday(playerId);
  if (!available) {
    return NextResponse.json({
      error: "This player has already been trained today. Come back tomorrow!",
      nextAvailableAt: getNextMidnightUTC(),
    }, { status: 429 });
  }

  // Calculate stat gain
  const { min, max } = trainingGainRange(session.managerLevel);
  const gain = min + Math.floor(Math.random() * (max - min + 1));
  const stat = TRAINING_STATS[Math.floor(Math.random() * TRAINING_STATS.length)];
  const currentVal = player[stat as keyof typeof player] as number;
  const newVal = Math.min(99, currentVal + gain);
  const actualGain = newVal - currentVal; // 0 if already at 99

  const today = new Date().toISOString().slice(0, 10);

  // Apply training + award player EXP
  const newPlayerExp = player.playerExp + STARTER_EXP_GAIN;
  const newPlayerLevel = playerLevelFromExp(newPlayerExp);

  await prisma.$transaction([
    // Update player stat
    prisma.player.update({
      where: { id: playerId },
      data: {
        [stat]: newVal,
        playerExp: newPlayerExp,
        playerLevel: newPlayerLevel,
      },
    }),
    // Log training
    prisma.trainingLog.create({
      data: {
        playerId,
        date: today,
        statGained: stat,
        amount: actualGain,
      },
    }),
    // Portal notification
    prisma.portalMessage.create({
      data: {
        type: "TRAINING",
        title: `${player.name} Completed Training`,
        content: `${player.name} worked hard in training today. ${stat.toUpperCase()} ${actualGain > 0 ? `+${actualGain} (now ${newVal})` : "already maxed at 99"}. Player EXP: ${newPlayerExp}.`,
        walletAddress: solanaWallet,
      },
    }),
  ]);

  // Mark trained in Redis
  await markTrained(playerId);

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
 * Returns training status for all user squad players.
 */
export async function GET(req: NextRequest) {
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });

  const session = await prisma.userSession.findUnique({ where: { solanaWallet: wallet } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const players = await prisma.player.findMany({
    where: { teamId: session.teamId },
    select: {
      id: true, name: true, position: true, starRating: true,
      pace: true, shooting: true, passing: true, defending: true, stamina: true,
      playerExp: true, playerLevel: true, avatarSvg: true,
    },
    orderBy: [{ starRating: "desc" }, { position: "asc" }],
  });

  const { getTrainingStatus } = await import("@/lib/redis/training");
  const trainingStatus = await getTrainingStatus(players.map((p) => p.id));

  return NextResponse.json({
    managerLevel: session.managerLevel,
    players: players.map((p) => ({
      ...p,
      canTrainToday: trainingStatus[p.id] ?? true,
    })),
    nextResetAt: getNextMidnightUTC(),
  });
}

function getNextMidnightUTC(): string {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}
