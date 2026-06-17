import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLeagueForWallet } from "@/lib/team-generator/generateLeague";
import { levelFromExp } from "@/lib/exp/manager";

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

export async function POST(req: NextRequest) {
  const { solanaWallet, privyUserId } = await req.json();

  if (!solanaWallet || typeof solanaWallet !== "string") {
    return NextResponse.json(
      { error: "solanaWallet required" },
      { status: 400 },
    );
  }

  // Returning user — find by wallet OR by privyUserId
  const existing = await prisma.userSession.findFirst({
    where: {
      OR: [{ solanaWallet }, ...(privyUserId ? [{ privyUserId }] : [])],
    },
    include: SESSION_INCLUDE,
  });

  if (existing) {
    // Update lastSeen and link privyUserId if not set
    await prisma.userSession.update({
      where: { id: existing.id },
      data: {
        lastSeenAt: new Date(),
        ...(privyUserId && !existing.privyUserId ? { privyUserId } : {}),
        // Sync wallet if changed (embedded wallet rotation)
        ...(existing.solanaWallet !== solanaWallet ? { solanaWallet } : {}),
      },
    });
    return NextResponse.json({ session: existing, isNew: false });
  }

  // New user — generate league + team
  try {
    const userTeamId = await createLeagueForWallet(solanaWallet);

    const session = await prisma.userSession.create({
      data: {
        solanaWallet,
        privyUserId: privyUserId ?? null,
        teamId: userTeamId,
      },
      include: SESSION_INCLUDE,
    });

    return NextResponse.json({ session, isNew: true });
  } catch (err: any) {
    if (err?.code === "P2002") {
      const session = await prisma.userSession.findUnique({
        where: { solanaWallet },
        include: SESSION_INCLUDE,
      });
      if (session) return NextResponse.json({ session, isNew: false });
    }
    console.error("[auth] create session error:", err);
    return NextResponse.json(
      { error: "Failed to initialize club. Try again." },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ session: null });

  const session = await prisma.userSession.findUnique({
    where: { solanaWallet: wallet },
    include: SESSION_INCLUDE,
  });
  return NextResponse.json({ session });
}

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
  if (!session)
    return NextResponse.json({ error: "Session not found" }, { status: 404 });

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
