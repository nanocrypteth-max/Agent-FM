import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/leagues/default?wallet=<address>
 * Returns the active league belonging to this wallet's team.
 * Falls back to the most recent active league if no wallet provided.
 */
export async function GET(req: NextRequest) {
  const wallet = new URL(req.url).searchParams.get("wallet");

  let leagueId: string | null = null;

  if (wallet) {
    // Find the league that contains this user's team
    const session = await prisma.userSession.findUnique({
      where: { solanaWallet: wallet },
      select: { teamId: true },
    });

    if (session) {
      const team = await prisma.team.findUnique({
        where: { id: session.teamId },
        select: { leagueId: true },
      });
      leagueId = team?.leagueId ?? null;
    }
  }

  // Build query
  const whereClause = leagueId
    ? { id: leagueId }
    : { status: "ACTIVE" as const };

  const league = await prisma.league.findFirst({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      fixtures: {
        orderBy: { round: "asc" },
        include: {
          homeTeam: { select: { name: true, isUserControlled: true } },
          awayTeam: { select: { name: true, isUserControlled: true } },
        },
      },
    },
  });

  if (!league) {
    return NextResponse.json(
      { error: "No league found. Please connect your wallet first." },
      { status: 404 },
    );
  }

  // Lazy progression: if all fixtures done, trigger next season
  const total = league.fixtures.length;
  const simulated = league.fixtures.filter(
    (f) => f.status === "SIMULATED",
  ).length;

  if (total > 0 && simulated === total) {
    const cronSecret = process.env.CRON_SECRET;
    const host = req.headers.get("host") ?? "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";

    fetch(`${protocol}://${host}/api/cron/check-league`, {
      method: "GET",
      headers: { authorization: `Bearer ${cronSecret}` },
    }).catch(() => {});
  }

  return NextResponse.json(league);
}
