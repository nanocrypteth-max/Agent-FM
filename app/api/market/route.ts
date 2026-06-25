import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Force dynamic rendering — this route queries the DB
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const position = searchParams.get("position");
  const minStar = parseInt(searchParams.get("minStar") ?? "1");
  const maxStar = parseInt(searchParams.get("maxStar") ?? "5");
  const sellerWallet = searchParams.get("sellerWallet");
  const includeSOLD = searchParams.get("includeSOLD") === "true";
  const usdOnly = searchParams.get("usd") === "1"; // new filter for USD tab

  const listings = await prisma.transferListing.findMany({
    where: {
      status:
        sellerWallet && includeSOLD ? { in: ["LISTED", "SOLD"] } : "LISTED",
      // Filter by listing type
      ...(usdOnly ? { isUSDListing: true } : { isSOLListing: true }),
      ...(sellerWallet ? { sellerWallet } : {}),
      player: {
        starRating: { gte: minStar, lte: maxStar },
        ...(position ? { position: position as any } : {}),
      },
    },
    include: {
      player: {
        select: {
          id: true,
          name: true,
          position: true,
          age: true,
          nationality: true,
          pace: true,
          shooting: true,
          passing: true,
          defending: true,
          stamina: true,
          starRating: true,
          marketValue: true,
          avatarSvg: true,
          fitness: true,
          morale: true,
        },
      },
      fromTeam: {
        select: { id: true, name: true, logoSvg: true, jerseyColor: true },
      },
    },
    orderBy: { listedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ listings });
}
