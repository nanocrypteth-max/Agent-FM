import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Force dynamic rendering — this route queries the DB
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
 * Called after Phantom connect. Creates or retrieves session by wallet address.
 * Uses upsert to handle race conditions (rapid reconnect, double-fire events).
 * Body: { solanaWallet: string }
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

  // Check if session already exists — fast path, avoids team lookup on reconnect
  const existing = await prisma.userSession.findUnique({
    where: { solanaWallet },
    include: SESSION_INCLUDE,
  });

  if (existing) {
    // Update lastSeen non-blocking (ignore failure — not critical)
    prisma.userSession
      .update({ where: { id: existing.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
    return NextResponse.json({ session: existing, isNew: false });
  }

  // New wallet — find unclaimed user-controlled team
  const userTeam = await prisma.team.findFirst({
    where: { isUserControlled: true },
  });
  if (!userTeam) {
    return NextResponse.json(
      { error: "No user team found. Run: npm run db:seed" },
      { status: 500 },
    );
  }

  const alreadyClaimed = await prisma.userSession.findUnique({
    where: { teamId: userTeam.id },
  });
  if (alreadyClaimed) {
    return NextResponse.json(
      { error: "Club already claimed by another wallet." },
      { status: 409 },
    );
  }

  // Use upsert instead of create to handle race conditions (P2002).
  // If two requests arrive simultaneously for the same wallet,
  // one will create and the other will update — both return a valid session.
  try {
    const session = await prisma.userSession.upsert({
      where: { solanaWallet },
      create: { solanaWallet, teamId: userTeam.id },
      update: { lastSeenAt: new Date() }, // already exists edge case
      include: SESSION_INCLUDE,
    });
    return NextResponse.json({ session, isNew: true });
  } catch (err: any) {
    // P2002 teamId unique constraint: another wallet claimed this team between
    // our check and our upsert (extremely rare but handle gracefully)
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Club was just claimed by another wallet. Please try again." },
        { status: 409 },
      );
    }
    throw err;
  }
}

/**
 * GET /api/auth?wallet=<address>
 * Returns existing session for wallet, or null.
 */
export async function GET(req: NextRequest) {
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ session: null });

  const session = await prisma.userSession.findUnique({
    where: { solanaWallet: wallet },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          logoSvg: true,
          jerseyColor: true,
          budget: true,
        },
      },
    },
  });

  return NextResponse.json({ session });
}

/**
 * PATCH /api/auth
 * Update user profile: displayName and/or avatarBase64.
 * Body: { solanaWallet, displayName?, avatarBase64?, teamName? }
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

  // Update session and team name separately to avoid conditional spread in $transaction
  // which causes Prisma type inference errors at build time
  const updatedSession = await prisma.userSession.update({
    where: { solanaWallet },
    data: updates,
    include: {
      team: {
        select: {
          id: true,
          name: true,
          logoSvg: true,
          jerseyColor: true,
          budget: true,
        },
      },
    },
  });

  if (teamName) {
    await prisma.team.update({
      where: { id: session.teamId },
      data: { name: String(teamName).slice(0, 40) },
    });
    // Reflect updated team name in response
    updatedSession.team.name = String(teamName).slice(0, 40);
  }

  return NextResponse.json({ session: updatedSession });
}
