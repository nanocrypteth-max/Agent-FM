import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Returns the active league.
 * Also performs a lazy check: if all fixtures in the active league are
 * SIMULATED, triggers the cron endpoint in the background to create the
 * next league. This ensures progression even on Vercel Hobby (daily cron only).
 */
export async function GET(req: Request) {
  const league = await prisma.league.findFirst({
    where: { status: "ACTIVE" },
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
      { error: "No league found. Run `npm run db:seed` first." },
      { status: 404 },
    );
  }

  // Lazy progression check: if all fixtures are done, trigger next league
  // in the background (non-blocking — response returns immediately)
  const total = league.fixtures.length;
  const simulated = league.fixtures.filter(
    (f) => f.status === "SIMULATED",
  ).length;

  if (total > 0 && simulated === total) {
    const cronSecret = process.env.CRON_SECRET;
    const baseUrl = req.headers.get("host")
      ? `https://${req.headers.get("host")}`
      : "http://localhost:3000";

    // Fire-and-forget — don't await, don't block the response
    fetch(`${baseUrl}/api/cron/check-league`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${cronSecret}`,
      },
    }).catch(() => {}); // silent fail — cron will retry tomorrow anyway
  }

  return NextResponse.json(league);
}
