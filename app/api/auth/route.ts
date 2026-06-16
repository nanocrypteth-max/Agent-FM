import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLeagueForWallet } from "@/lib/team-generator/generateLeague";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SESSION_INCLUDE = {
  team: {
    select: {
      id: true,
      name: true,
      logoSvg: true,
      jerseyColor: true,
      budget: true,
    },
  },
} as const;

/**
 * POST /api/auth
 * Connect wallet → get or create session + league.
 * Each wallet gets its own unique team and league vs 7 AI teams.
 */
export async function POST(req: NextRequest) {
  const { solanaWallet } = await req.json();

  if (!solanaWallet || typeof solanaWallet !== "string") {
    return NextResponse.json(
      { error: "solanaWallet required" },
      { status: 400 },
    );
  }

  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(solanaWallet)) {
    return NextResponse.json(
      { error: "Invalid Solana wallet address" },
      { status: 400 },
    );
  }

  // Fast path: returning user
  const existing = await prisma.userSession.findUnique({
    where: { solanaWallet },
    include: SESSION_INCLUDE,
  });

  if (existing) {
    prisma.userSession
      .update({ where: { id: existing.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
    return NextResponse.json({ session: existing, isNew: false });
  }

  // New wallet — generate a full league (1 user team + 7 AI + fixtures)
  try {
    const userTeamId = await createLeagueForWallet(solanaWallet);

    const session = await prisma.userSession.create({
      data: { solanaWallet, teamId: userTeamId },
      include: SESSION_INCLUDE,
    });

    return NextResponse.json({ session, isNew: true });
  } catch (err: any) {
    // P2002: race condition (two requests for same wallet simultaneously)
    if (err?.code === "P2002") {
      const session = await prisma.userSession.findUnique({
        where: { solanaWallet },
        include: SESSION_INCLUDE,
      });
      if (session) return NextResponse.json({ session, isNew: false });
    }
    console.error("[auth] Failed to create session:", err);
    return NextResponse.json(
      { error: "Failed to initialize your club. Please try again." },
      { status: 500 },
    );
  }
}

/**
 * GET /api/auth?wallet=<address>
 */
export async function GET(req: NextRequest) {
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ session: null });

  const session = await prisma.userSession.findUnique({
    where: { solanaWallet: wallet },
    include: SESSION_INCLUDE,
  });

  return NextResponse.json({ session });
}

/**
 * PATCH /api/auth
 * Update displayName, avatarBase64, teamName.
 */
export async function PATCH(req: NextRequest) {
  const { solanaWallet, displayName, avatarBase64, teamName } =
    await req.json();

  if (!solanaWallet) {
    return NextResponse.json(
      { error: "solanaWallet required" },
      { status: 400 },
    );
  }

  const session = await prisma.userSession.findUnique({
    where: { solanaWallet },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (avatarBase64 && avatarBase64.length > 2_800_000) {
    return NextResponse.json(
      { error: "Avatar too large. Max 2MB." },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = { lastSeenAt: new Date() };
  if (displayName !== undefined)
    updates.displayName = String(displayName).slice(0, 30);
  if (avatarBase64 !== undefined) updates.avatarBase64 = avatarBase64;

  const updatedSession = await prisma.userSession.update({
    where: { solanaWallet },
    data: updates,
    include: SESSION_INCLUDE,
  });

  if (teamName) {
    await prisma.team.update({
      where: { id: session.teamId },
      data: { name: String(teamName).slice(0, 40) },
    });
    updatedSession.team.name = String(teamName).slice(0, 40);
  }

  return NextResponse.json({ session: updatedSession });
}
