import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POSITIONS = ["GK","DF","DF","DF","MF","MF","MF","FW","FW"];
const NATIONALITIES = ["Brazil","France","Argentina","England","Spain","Germany","Italy","Portugal","Netherlands","Japan","Nigeria","Senegal"];
const FIRST = ["Marcus","Luca","Diego","Ethan","Alexis","Rafael","Leon","Jules","Santi","Kenji","Amara","Sadio","Christiano","Johan","Bruno"];
const LAST  = ["Silva","Müller","Torres","Kane","Benzema","Nkunku","Vidal","Mbappé","Iniesta","Endo","Diallo","Mané","Ronaldo","Cruyff","Fernandes"];

function rng(seed: number, min: number, max: number) {
  const x = Math.sin(seed) * 10000;
  return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min;
}

function makePlayer(i: number, star: number) {
  const base = star === 3 ? 55 : star === 4 ? 68 : 80;
  return {
    name: `${FIRST[rng(i*7,0,FIRST.length-1)]} ${LAST[rng(i*13,0,LAST.length-1)]}`,
    position: POSITIONS[rng(i*3,0,POSITIONS.length-1)],
    age: rng(i*5, 19, 33),
    nationality: NATIONALITIES[rng(i*11,0,NATIONALITIES.length-1)],
    starRating: star,
    pace:      rng(i*17, base, base+10),
    shooting:  rng(i*19, base, base+10),
    passing:   rng(i*23, base, base+10),
    defending: rng(i*29, base, base+10),
    stamina:   rng(i*31, base, base+10),
    available: true,
  };
}

/** GET /api/store/seed?secret=<CRON_SECRET> — seed store players */
export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.storePlayer.deleteMany({});

  const players = [
    ...Array.from({ length: 8 }, (_, i) => makePlayer(i, 3)),
    ...Array.from({ length: 6 }, (_, i) => makePlayer(i + 100, 4)),
    ...Array.from({ length: 4 }, (_, i) => makePlayer(i + 200, 5)),
  ];

  await prisma.storePlayer.createMany({ data: players });
  return NextResponse.json({ seeded: players.length });
}
