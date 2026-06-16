import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generatePlayerAvatar } from "@/lib/svg/generateAvatar";
import { generateClubLogo } from "@/lib/svg/generateLogo";

const Schema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  tier: z.enum(["STANDARD", "PREMIUM"]),
  walletAddr: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

const POSITION_LIST = ["GK", "DF", "MF", "FW"] as const;
const FIRST_NAMES = ["Zara","Rio","Kai","Nova","Axel","Cruz","Zion","Vale","Rex","Sora"];
const LAST_NAMES = ["Storm","Vega","Blaze","Frost","Cruz","Nova","Stone","Vale","Ryder","Fox"];

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6d2b79f5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function attr(base: number, v: number, rng: () => number): number {
  return Math.max(40, Math.min(99, base + Math.floor(rng() * v * 2) - v));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { txHash, tier, walletAddr } = parsed.data;

  // Idempotent: check if already processed
  const existing = await prisma.gachaSpin.findUnique({ where: { txHash } });
  if (existing?.status === "COMPLETED") {
    const player = existing.playerId
      ? await prisma.player.findUnique({ where: { id: existing.playerId } })
      : null;
    return NextResponse.json({ alreadyProcessed: true, player });
  }

  // TODO: In production, verify tx on-chain via provider.getTransactionReceipt()
  // For now, trust the client (acceptable for testnet MVP)

  const userTeam = await prisma.team.findFirst({ where: { isUserControlled: true } });
  if (!userTeam) return NextResponse.json({ error: "User team not found" }, { status: 400 });

  // Generate star rating for tier
  const seed = parseInt(txHash.slice(2, 10), 16);
  const rng = mulberry32(seed);

  let starRating: number;
  if (tier === "STANDARD") {
    // 1★: 50%, 2★: 30%, 3★: 20%
    const roll = rng();
    starRating = roll < 0.5 ? 1 : roll < 0.8 ? 2 : 3;
  } else {
    // 3★: 40%, 4★: 40%, 5★: 20%
    const roll = rng();
    starRating = roll < 0.4 ? 3 : roll < 0.8 ? 4 : 5;
  }

  // Generate unique player
  const firstName = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
  const name = `${firstName} ${lastName} G${txHash.slice(2, 6).toUpperCase()}`;
  const position = POSITION_LIST[Math.floor(rng() * POSITION_LIST.length)];

  const baseAttr = 40 + starRating * 10;
  const attrs = {
    pace: attr(baseAttr, 12, rng),
    shooting: attr(position === "FW" ? baseAttr + 10 : baseAttr - 10, 12, rng),
    passing: attr(position === "MF" ? baseAttr + 10 : baseAttr, 12, rng),
    defending: attr(position === "DF" || position === "GK" ? baseAttr + 10 : baseAttr - 15, 10, rng),
    stamina: attr(baseAttr, 12, rng),
  };

  const marketValue = [50000, 150000, 400000, 1000000, 3000000][starRating - 1];
  const avatarSvg = generatePlayerAvatar({ name, position, jerseyColor: userTeam.jerseyColor, starRating });

  const spin = await prisma.$transaction(async (tx) => {
    // Create player
    const player = await tx.player.create({
      data: {
        name, position, age: 20 + Math.floor(rng() * 10),
        nationality: "International",
        ...attrs, starRating, marketValue, avatarSvg,
        fitness: 100, morale: 90,
        teamId: userTeam.id,
        isInUserSquad: true,
      },
    });

    // Add to user squad (bench by default)
    await tx.userSquad.create({ data: { playerId: player.id, slotIndex: null } });

    // Log transfer
    await tx.transferLog.create({
      data: {
        playerId: player.id,
        toTeamId: userTeam.id,
        price: 0,
        source: "GACHA",
      },
    });

    // Record spin
    const spinRecord = await tx.gachaSpin.upsert({
      where: { txHash },
      create: { walletAddr, tier, txHash, playerId: player.id, status: "COMPLETED" },
      update: { playerId: player.id, status: "COMPLETED" },
    });

    // Portal notification
    await tx.portalMessage.create({
      data: {
        type: "GACHA",
        title: `🎰 Gacha Result: ${starRating}★ Player Acquired!`,
        content: `You spun a ${tier} capsule and received ${name} (${position}, ★${starRating})! The player has been added to your squad.`,
        metadata: { playerId: player.id, starRating, tier, txHash },
      },
    });

    return { spin: spinRecord, player };
  });

  return NextResponse.json({
    success: true,
    player: spin.player,
    starRating,
    tier,
  });
}
