import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Returns the first league found (this MVP supports a single league).
 * Used by the home page to bootstrap without needing to know the league ID.
 */
export async function GET() {
  const league = await prisma.league.findFirst({
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
      { error: "No league found. Run `npm run db:seed` first." },
      { status: 404 }
    );
  }

  return NextResponse.json(league);
}
