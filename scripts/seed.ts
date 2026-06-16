import { PrismaClient, Position } from "@prisma/client";
import { generatePlayerAvatar } from "../lib/svg/generateAvatar";
import { generateClubLogo } from "../lib/svg/generateLogo";

const prisma = new PrismaClient();

const TEAM_NAMES = [
  "Ironclad FC",
  "Vellora United",
  "Stonebridge Athletic",
  "Crimson Rovers",
  "Northgate City",
  "Pellham Wanderers",
  "Solace Town",
  "Mariner's Cove FC",
];

const JERSEY_COLORS = [
  "#ff5252",
  "#4fc3f7",
  "#66bb6a",
  "#ef5350",
  "#42a5f5",
  "#ab47bc",
  "#ffa726",
  "#26c6da",
];

const FIRST_NAMES = [
  "Marco",
  "Luca",
  "Diego",
  "Rafa",
  "Karim",
  "Thierry",
  "Zlatan",
  "Romelu",
  "Sadio",
  "Mo",
  "Kylian",
  "Erling",
  "Vinicius",
  "Jude",
  "Pedri",
  "Gavi",
  "Phil",
  "Bukayo",
  "Marcus",
  "Jadon",
  "Mason",
  "Trent",
  "Reece",
  "Kyle",
  "Virgil",
  "Ruben",
  "Dayot",
  "Eder",
  "Milan",
  "Sven",
  "Ante",
  "Marcelo",
];
const LAST_NAMES = [
  "Rossi",
  "Silva",
  "Torres",
  "Benzema",
  "Mane",
  "Salah",
  "Mbappe",
  "Haaland",
  "Junior",
  "Bellingham",
  "Hernandez",
  "Foden",
  "Saka",
  "Rashford",
  "Sancho",
  "Mount",
  "Alexander",
  "James",
  "Walker",
  "Dias",
  "Upamecano",
  "Militao",
  "Skriniar",
  "Brozovic",
  "Rebic",
  "Kovacic",
  "Morata",
  "Griezmann",
  "Kane",
  "Lewandowski",
  "Muller",
  "Neuer",
  "Alisson",
  "Ederson",
  "Courtois",
  "Oblak",
];

const NATIONALITIES = [
  "Brazil",
  "France",
  "England",
  "Spain",
  "Germany",
  "Argentina",
  "Portugal",
  "Italy",
  "Netherlands",
  "Belgium",
  "Croatia",
  "Senegal",
  "Egypt",
  "Norway",
];

function randomName(used: Set<string>, rng: () => number): string {
  let name: string;
  let tries = 0;
  do {
    const f = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
    const l = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
    name = `${f} ${l}`;
    tries++;
    if (tries > 100) {
      name = `${name}_${tries}`;
      break;
    }
  } while (used.has(name));
  used.add(name);
  return name;
}

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function attr(base: number, variance: number, rng: () => number): number {
  return Math.max(
    30,
    Math.min(99, base + Math.floor(rng() * variance * 2) - variance),
  );
}

/** Compute star rating from overall attribute average */
function computeStarRating(attrs: number[]): number {
  const avg = attrs.reduce((a, b) => a + b, 0) / attrs.length;
  if (avg >= 85) return 5;
  if (avg >= 75) return 4;
  if (avg >= 65) return 3;
  if (avg >= 52) return 2;
  return 1;
}

/** Market value based on star rating and specific skill */
function computeMarketValue(starRating: number, topAttr: number): number {
  const base = [50000, 150000, 400000, 1000000, 3000000];
  return Math.round(base[starRating - 1] * (0.8 + topAttr / 100));
}

const SQUAD_COMPOSITION: Array<{ position: Position; count: number }> = [
  { position: "GK", count: 2 },
  { position: "DF", count: 6 },
  { position: "MF", count: 6 },
  { position: "FW", count: 4 },
];

async function main() {
  console.log("Seeding database...\n");

  // Clean slate
  await prisma.userSquad.deleteMany();
  await prisma.gachaSpin.deleteMany();
  await prisma.portalMessage.deleteMany();
  await prisma.transferLog.deleteMany();
  await prisma.transferListing.deleteMany();
  await prisma.userTactics.deleteMany();
  await prisma.matchResult.deleteMany();
  await prisma.fixture.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.league.deleteMany();

  const league = await prisma.league.create({
    data: {
      name: "AI Manager Premier League",
      trophyName: "The World Stage Trophy",
      season: 1,
      status: "ACTIVE",
    },
  });

  const usedNames = new Set<string>();

  for (let i = 0; i < TEAM_NAMES.length; i++) {
    const name = TEAM_NAMES[i];
    const jerseyColor = JERSEY_COLORS[i];
    const isUserControlled = i === 0;
    const teamSeed = hashStr(name);
    const rng = mulberry32(teamSeed);
    const teamQuality = 45 + Math.floor(rng() * 30); // 45-75

    // Generate logo
    const logoSvg = generateClubLogo({ name, primaryColor: jerseyColor });

    const playersData: any[] = [];

    for (const { position, count } of SQUAD_COMPOSITION) {
      for (let j = 0; j < count; j++) {
        const pName = randomName(usedNames, rng);
        const age = 18 + Math.floor(rng() * 18); // 18-35
        const nationality =
          NATIONALITIES[Math.floor(rng() * NATIONALITIES.length)];

        let base = {
          pace: 0,
          shooting: 0,
          passing: 0,
          defending: 0,
          stamina: 0,
        };
        const v = 12;
        switch (position) {
          case "GK":
            base = {
              pace: attr(teamQuality - 10, v, rng),
              shooting: attr(20, 5, rng),
              passing: attr(teamQuality - 5, v, rng),
              defending: attr(teamQuality + 15, v, rng),
              stamina: attr(teamQuality, v, rng),
            };
            break;
          case "DF":
            base = {
              pace: attr(teamQuality, v, rng),
              shooting: attr(30, 8, rng),
              passing: attr(teamQuality, v, rng),
              defending: attr(teamQuality + 12, v, rng),
              stamina: attr(teamQuality + 5, v, rng),
            };
            break;
          case "MF":
            base = {
              pace: attr(teamQuality, v, rng),
              shooting: attr(teamQuality, v, rng),
              passing: attr(teamQuality + 12, v, rng),
              defending: attr(teamQuality, v, rng),
              stamina: attr(teamQuality + 10, v, rng),
            };
            break;
          case "FW":
            base = {
              pace: attr(teamQuality + 12, v, rng),
              shooting: attr(teamQuality + 12, v, rng),
              passing: attr(teamQuality, v, rng),
              defending: attr(25, 8, rng),
              stamina: attr(teamQuality, v, rng),
            };
            break;
        }

        const allAttrs = Object.values(base);
        const starRating = computeStarRating(allAttrs);
        const topAttr = Math.max(...allAttrs);
        const marketValue = computeMarketValue(starRating, topAttr);
        const avatarSvg = generatePlayerAvatar({
          name: pName,
          position,
          jerseyColor,
          starRating,
        });

        playersData.push({
          name: pName,
          position,
          age,
          nationality,
          ...base,
          starRating,
          marketValue,
          avatarSvg,
          fitness: 90 + Math.floor(rng() * 10),
          morale: 60 + Math.floor(rng() * 30),
          isInUserSquad: isUserControlled, // all starting players of user team are in squad
        });
      }
    }

    const avgOf = (pos: Position, key: string) => {
      const pool = playersData.filter((p) => p.position === pos);
      return Math.round(
        pool.reduce((s: number, p: any) => s + p[key], 0) / pool.length,
      );
    };

    const overallAtk = Math.round(
      (avgOf("FW", "shooting") + avgOf("MF", "passing")) / 2,
    );
    const overallMid = Math.round(
      (avgOf("MF", "passing") + avgOf("MF", "stamina")) / 2,
    );
    const overallDef = Math.round(
      (avgOf("DF", "defending") + avgOf("GK", "defending")) / 2,
    );

    await prisma.team.create({
      data: {
        name,
        leagueId: league.id,
        isUserControlled,
        jerseyColor,
        logoSvg,
        overallAtk,
        overallMid,
        overallDef,
        budget: 5_000_000,
        players: { create: playersData },
      },
    });

    const stars = "★".repeat(
      Math.round((overallAtk + overallMid + overallDef) / 3 / 20),
    );
    console.log(
      `  ${isUserControlled ? "[YOU] " : "      "}${name.padEnd(24)} ${stars} | ATK ${overallAtk} MID ${overallMid} DEF ${overallDef}`,
    );
  }

  // Seed initial portal welcome message
  await prisma.portalMessage.create({
    data: {
      type: "SYSTEM",
      title: "Welcome to the World Stage 2026",
      content:
        "Your managerial career begins now. Lead Ironclad FC to glory. Transfer market is open — scout players, spin the gacha for hidden gems, and dominate the league.",
    },
  });

  console.log(`\nLeague created: "${league.name}"`);
  console.log(`League ID: ${league.id}`);

  // Seed some market listings from AI teams (not user team)
  const nonUserTeams = await prisma.team.findMany({
    where: { leagueId: league.id, isUserControlled: false },
    include: { players: { orderBy: { starRating: "asc" }, take: 3 } },
  });

  for (const team of nonUserTeams) {
    for (const player of team.players.slice(0, 2)) {
      const price = Math.round(
        player.marketValue * (1.0 + Math.random() * 0.3),
      );
      await prisma.transferListing.create({
        data: {
          playerId: player.id,
          fromTeamId: team.id,
          price,
          status: "LISTED",
        },
      });
    }
  }

  const listingsCount = await prisma.transferListing.count();
  console.log(`Transfer Market: ${listingsCount} players listed for sale`);
  console.log(`\nNext steps:`);
  console.log(`  1. npx prisma migrate dev --name add_new_features`);
  console.log(
    `  2. curl -X POST http://localhost:3000/api/leagues/${league.id}/generate-fixtures`,
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
