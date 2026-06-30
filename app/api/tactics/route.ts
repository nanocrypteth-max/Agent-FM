import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/tactics?wallet=xxx — list all tactics templates for user */
export async function GET(req: NextRequest) {
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });

  const templates = await prisma.tacticsTemplate.findMany({
    where: { walletAddress: wallet },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ templates });
}

/** POST /api/tactics — save a new tactics template */
export async function POST(req: NextRequest) {
  const { wallet, name, formation, slots } = await req.json();

  if (!wallet || !name || !formation || !slots) {
    return NextResponse.json({ error: "wallet, name, formation, slots required" }, { status: 400 });
  }
  if (!name.trim()) {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  }
  if (slots.length !== 11) {
    return NextResponse.json({ error: "Must have exactly 11 slots" }, { status: 400 });
  }

  // Max 10 templates per user
  const count = await prisma.tacticsTemplate.count({ where: { walletAddress: wallet } });
  if (count >= 10) {
    return NextResponse.json({ error: "Maximum 10 templates — delete one first" }, { status: 400 });
  }

  const template = await prisma.tacticsTemplate.create({
    data: { walletAddress: wallet, name: name.trim().slice(0, 30), formation, slots },
  });

  return NextResponse.json({ template });
}

/** DELETE /api/tactics?id=xxx&wallet=xxx — delete a template */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const wallet = searchParams.get("wallet");

  if (!id || !wallet) return NextResponse.json({ error: "id and wallet required" }, { status: 400 });

  const template = await prisma.tacticsTemplate.findUnique({ where: { id } });
  if (!template || template.walletAddress !== wallet) {
    return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
  }

  await prisma.tacticsTemplate.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
