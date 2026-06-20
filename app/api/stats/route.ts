import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/stats
 * Public, anonymous global statistics for the landing page.
 * No user-specific or sensitive data exposed — counts only.
 */
export async function GET() {
  const [totalClubs, totalMatches, totalLeagues, totalGoalsAgg] = await Promise.all([
    prisma.userSession.count(),
    prisma.matchResult.count(),
    prisma.league.count(),
    prisma.fixture.aggregate({
      where: { status: "SIMULATED" },
      _sum: { homeScore: true, awayScore: true },
    }),
  ]);

  const totalGoals =
    (totalGoalsAgg._sum.homeScore ?? 0) + (totalGoalsAgg._sum.awayScore ?? 0);

  return NextResponse.json({
    totalClubs,
    totalMatches,
    totalLeagues,
    totalGoals,
  });
}
