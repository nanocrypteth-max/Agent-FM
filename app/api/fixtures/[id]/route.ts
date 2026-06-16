import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Force dynamic rendering — this route queries the DB
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const fixture = await prisma.fixture.findUnique({
    where: { id: params.id },
    include: {
      homeTeam: { select: { id: true, name: true, isUserControlled: true } },
      awayTeam: { select: { id: true, name: true, isUserControlled: true } },
      matchResult: true,
    },
  });

  if (!fixture) {
    return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
  }

  if (fixture.status !== "SIMULATED" || !fixture.matchResult) {
    return NextResponse.json({
      fixtureId: fixture.id,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      status: fixture.status,
      simulated: false,
    });
  }

  return NextResponse.json({
    fixtureId: fixture.id,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    homeScore: fixture.homeScore,
    awayScore: fixture.awayScore,
    homeTactics: fixture.matchResult.homeTactics,
    awayTactics: fixture.matchResult.awayTactics,
    events: fixture.matchResult.events,
    narrative: fixture.matchResult.narrative,
    simulated: true,
  });
}
