import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Force dynamic rendering — this route queries the DB
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const TacticsInputSchema = z.object({
  formation: z.enum(["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "5-3-2", "4-5-1"]),
  mentality: z.enum(["DEFENSIVE", "BALANCED", "ATTACKING"]),
  startingXI: z.array(z.string()).length(11),
  instructions: z.object({
    pressing: z.enum(["LOW", "MEDIUM", "HIGH"]),
    tempo: z.enum(["SLOW", "NORMAL", "FAST"]),
    width: z.enum(["NARROW", "NORMAL", "WIDE"]),
  }),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const fixtureId = params.id;
  const body = await req.json();

  const parsed = TacticsInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid tactics", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const fixture = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    include: {
      homeTeam: { include: { players: true } },
      awayTeam: { include: { players: true } },
    },
  });

  if (!fixture) {
    return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
  }

  if (fixture.status === "SIMULATED") {
    return NextResponse.json(
      { error: "Fixture already simulated, cannot change tactics" },
      { status: 409 },
    );
  }

  const userTeam = fixture.homeTeam.isUserControlled
    ? fixture.homeTeam
    : fixture.awayTeam.isUserControlled
      ? fixture.awayTeam
      : null;

  if (!userTeam) {
    return NextResponse.json(
      { error: "Neither team in this fixture is user-controlled" },
      { status: 403 },
    );
  }

  const { formation, mentality, startingXI, instructions } = parsed.data;

  const squadIds = new Set(userTeam.players.map((p) => p.id));
  const invalidIds = startingXI.filter((id) => !squadIds.has(id));
  if (invalidIds.length > 0) {
    return NextResponse.json(
      { error: `Invalid player IDs: ${invalidIds.join(", ")}` },
      { status: 400 },
    );
  }

  const gkCount = userTeam.players.filter(
    (p) => startingXI.includes(p.id) && p.position === "GK",
  ).length;
  if (gkCount !== 1) {
    return NextResponse.json(
      { error: `Squad must include exactly 1 GK, got ${gkCount}` },
      { status: 400 },
    );
  }

  if (new Set(startingXI).size !== 11) {
    return NextResponse.json(
      { error: "startingXI contains duplicate player IDs" },
      { status: 400 },
    );
  }

  const tactics = { formation, mentality, startingXI, instructions };

  await prisma.userTactics.upsert({
    where: { fixtureId },
    create: { fixtureId, teamId: userTeam.id, tactics: tactics as any },
    update: { tactics: tactics as any, submittedAt: new Date() },
  });

  return NextResponse.json({ fixtureId, teamId: userTeam.id, tactics });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userTactics = await prisma.userTactics.findUnique({
    where: { fixtureId: params.id },
  });

  if (!userTactics) {
    return NextResponse.json(
      { error: "No tactics submitted yet" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    fixtureId: userTactics.fixtureId,
    teamId: userTactics.teamId,
    tactics: userTactics.tactics,
    submittedAt: userTactics.submittedAt,
  });
}
