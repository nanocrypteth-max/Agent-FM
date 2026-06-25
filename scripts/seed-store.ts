/**
 * Seed game store with 3★-5★ players.
 * Run: npx ts-node scripts/seed-store.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const POSITIONS = ["GK","DF","DF","DF","MF","MF","MF","FW","FW"] as const;
const NATIONALITIES = ["Brazil","France","Argentina","England","Spain","Germany","Italy","Portugal","Netherlands","Japan","Nigeria","Senegal"];
const FIRST = ["Marcus","Luca","Diego","Ethan","Alexis","Rafael","Leon","Jules","Santi","Kenji","Amara","Sadio","Christiano","Johan","Bruno"];
const LAST  = ["Silva","Müller","Torres","Kane","Benzema","Nkunku","Vidal","Mbappé","Iniesta","Endo","Diallo","Mané","Ronaldo","Cruyff","Fernandes"];

function rng(seed: number, min: number, max: number) {
  const x = Math.sin(seed) * 10000;
  return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min;
}

function makePlayer(i: number, star: number) {
  const base = star === 3 ? 55 : star === 4 ? 68 : 80;
  const spread = 10;
  const firstName = FIRST[rng(i * 7, 0, FIRST.length - 1)];
  const lastName = LAST[rng(i * 13, 0, LAST.length - 1)];
  const pos = POSITIONS[rng(i * 3, 0, POSITIONS.length - 1)];
  return {
    name: `${firstName} ${lastName}`,
    position: pos,
    age: rng(i * 5, 19, 33),
    nationality: NATIONALITIES[rng(i * 11, 0, NATIONALITIES.length - 1)],
    starRating: star,
    pace:      rng(i * 17, base, base + spread),
    shooting:  rng(i * 19, base, base + spread),
    passing:   rng(i * 23, base, base + spread),
    defending: rng(i * 29, base, base + spread),
    stamina:   rng(i * 31, base, base + spread),
    available: true,
  };
}

async function main() {
  // Clear existing store
  await prisma.storePlayer.deleteMany({});

  const players = [
    // 3★ — 8 players
    ...Array.from({ length: 8 }, (_, i) => makePlayer(i, 3)),
    // 4★ — 6 players
    ...Array.from({ length: 6 }, (_, i) => makePlayer(i + 100, 4)),
    // 5★ — 4 players
    ...Array.from({ length: 4 }, (_, i) => makePlayer(i + 200, 5)),
  ];

  await prisma.storePlayer.createMany({ data: players });
  console.log(`Seeded ${players.length} store players`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
