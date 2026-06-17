import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchExpGain, levelFromExp } from "@/lib/exp/manager";
import { computeMVP, MVP_EXP_GAIN, STARTER_EXP_GAIN, playerLevelFromExp } from "@/lib/exp/player";
import type { MatchEvent } from "@/lib/match-engine/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/exp
 * Called internally after a match is simulated.
 * Awards EXP to managers and MVP player.
 * Body: { matchResultId, homeTeamId, awayTeamId, homeScore, awayScore, events }
 */
export async function POST(req: NextRequest) {
  const { matchResultId, homeTeamId, awayTeamId, homeScore, awayScore, events } = await req.json();

  const mvpPlayerId = computeMVP(events as MatchEvent[]);

  // Find managers for home and away teams
  const [homeSession, awaySession] = await Promise.all([
    prisma.userSession.findUnique({ where: { teamId: homeTeamId } }),
    prisma.userSession.findUnique({ where: { teamId: awayTeamId } }),
  ]);

  const updates: Promise<unknown>[] = [];

  // Helper: award exp to a session
  const awardManagerExp = (session: typeof homeSession, result: "WIN" | "DRAW" | "LOSS") => {
    if (!session) return;
    const gained = matchExpGain(result, session.managerLevel);
    const newExp = session.managerExp + gained;
    const newLevel = levelFromExp(newExp);
    const leveledUp = newLevel > session.managerLevel;

    updates.push(
      prisma.userSession.update({
        where: { id: session.id },
        data: {
          managerExp: newExp,
          managerLevel: newLevel,
          totalMatches: { increment: 1 },
          totalWins: result === "WIN" ? { increment: 1 } : undefined,
        },
      })
    );

    if (leveledUp) {
      updates.push(
        prisma.portalMessage.create({
          data: {
            type: "EXP",
            title: `🎉 Level Up! You're now Level ${newLevel}`,
            content: `Congratulations! Your managerial career has reached Level ${newLevel}. Training gains are now higher and your team will develop faster.`,
            walletAddress: session.solanaWallet,
          },
        })
      );
    }
  };

  // Determine results
  if (homeScore > awayScore) {
    awardManagerExp(homeSession, "WIN");
    awardManagerExp(awaySession, "LOSS");
  } else if (homeScore < awayScore) {
    awardManagerExp(homeSession, "LOSS");
    awardManagerExp(awaySession, "WIN");
  } else {
    awardManagerExp(homeSession, "DRAW");
    awardManagerExp(awaySession, "DRAW");
  }

  // Award MVP player EXP
  if (mvpPlayerId) {
    const mvpPlayer = await prisma.player.findUnique({ where: { id: mvpPlayerId } });
    if (mvpPlayer) {
      const newExp = mvpPlayer.playerExp + MVP_EXP_GAIN;
      const newLevel = playerLevelFromExp(newExp);
      updates.push(
        prisma.player.update({
          where: { id: mvpPlayerId },
          data: { playerExp: newExp, playerLevel: newLevel },
        })
      );
    }

    // Update match result with MVP
    updates.push(
      prisma.matchResult.update({
        where: { id: matchResultId },
        data: { mvpPlayerId },
      })
    );
  }

  await Promise.all(updates);

  return NextResponse.json({ success: true, mvpPlayerId });
}
