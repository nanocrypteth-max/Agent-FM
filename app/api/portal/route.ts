import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePortalNews } from "@/lib/portal/generateNews";

// Force dynamic rendering — this route queries the DB
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const take = 20;

  // Auto-generate news if none generated today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayCount = await prisma.portalMessage.count({
    where: { type: "NEWS", createdAt: { gte: today } },
  });

  if (todayCount === 0) {
    // Background: generate AI news (non-blocking)
    generatePortalNews().catch(console.error);
  }

  const [messages, total] = await Promise.all([
    prisma.portalMessage.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
    }),
    prisma.portalMessage.count(),
  ]);

  return NextResponse.json({ messages, total, page });
}

// Mark message as read
export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    await prisma.portalMessage.update({
      where: { id },
      data: { isRead: true },
    });
  } else {
    // Mark all as read
    await prisma.portalMessage.updateMany({ data: { isRead: true } });
  }

  return NextResponse.json({ success: true });
}
