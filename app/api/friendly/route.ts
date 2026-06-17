import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pusher, CHANNELS, EVENTS } from "@/lib/pusher/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Generate a unique 6-char uppercase lobby code */
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/**
 * POST /api/friendly — Create a new lobby
 * Body: { solanaWallet }
 */
export async function POST(req: NextRequest) {
  const { solanaWallet } = await req.json();
  if (!solanaWallet) return NextResponse.json({ error: "solanaWallet required" }, { status: 400 });

  const session = await prisma.userSession.findUnique({ where: { solanaWallet } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  // Cancel any existing open lobbies from this user
  await prisma.friendlyMatch.updateMany({
    where: { hostTeamId: session.teamId, status: "WAITING" },
    data: { status: "CANCELLED" },
  });

  // Generate unique code
  let code = generateCode();
  let attempts = 0;
  while (attempts < 10) {
    const exists = await prisma.friendlyMatch.findUnique({ where: { code } });
    if (!exists) break;
    code = generateCode();
    attempts++;
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

  const lobby = await prisma.friendlyMatch.create({
    data: {
      code,
      hostTeamId: session.teamId,
      pusherChannel: CHANNELS.friendly(code),
      expiresAt,
      status: "WAITING",
    },
    include: {
      hostTeam: { select: { name: true, logoSvg: true, jerseyColor: true } },
    },
  });

  return NextResponse.json({ lobby, code });
}

/**
 * GET /api/friendly — List open lobbies (excluding expired)
 */
export async function GET() {
  const lobbies = await prisma.friendlyMatch.findMany({
    where: {
      status: "WAITING",
      expiresAt: { gt: new Date() },
    },
    include: {
      hostTeam: { select: { name: true, logoSvg: true, jerseyColor: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ lobbies });
}
