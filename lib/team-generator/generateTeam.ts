import { generatePlayerAvatar } from "@/lib/svg/generateAvatar";
import { generateClubLogo } from "@/lib/svg/generateLogo";

// ─── Team Name Components ─────────────────────────────────────────────────────

const PREFIXES = [
  "Iron", "Storm", "Vell", "Stone", "Crimson", "North", "Silver", "Gold",
  "Black", "Red", "Blue", "Royal", "Dark", "Bright", "Swift", "Bold",
  "Frost", "Ember", "Ash", "Dawn", "Dusk", "Peak", "Vale", "Cape",
];

const SUFFIXES = [
  "FC", "United", "City", "Athletic", "Rovers", "Wanderers", "Town",
  "Rangers", "Knights", "Lions", "Eagles", "Wolves", "Bears", "Hawks",
];

const JERSEY_COLORS = [
  "#ff5252", "#4fc3f7", "#66bb6a", "#ef5350", "#42a5f5",
  "#ab47bc", "#ffa726", "#26c6da", "#ec407a", "#7e57c2",
  "#26a69a", "#d4e157", "#ff7043", "#8d6e63", "#78909c",
];

const FIRST_NAMES = [
  "Marco","Luca","Diego","Rafa","Karim","Thierry","Romelu","Sadio",
  "Mo","Kylian","Erling","Vinicius","Jude","Pedri","Phil","Bukayo",
  "Marcus","Jadon","Mason","Trent","Reece","Kyle","Virgil","Ruben",
  "Eder","Milan","Sven","Ante","Kai","Leroy","Raheem","Son","Richarlison",
];

const LAST_NAMES = [
  "Rossi","Silva","Torres","Benzema","Mane","Salah","Mbappe","Haaland",
  "Junior","Bellingham","Hernandez","Foden","Saka","Rashford","Sancho",
  "Mount","Alexander","James","Walker","Dias","Militao","Skriniar",
  "Brozovic","Rebic","Kovacic","Griezmann","Kane","Lewandowski","Muller",
  "Neuer","Alisson","Ederson","Courtois","Oblak","Szczesny","Trapp",
];

const NATIONALITIES = [
  "Brazil","France","England","Spain","Germany","Argentina","Portugal",
  "Italy","Netherlands","Belgium","Croatia","Senegal","Egypt","Norway",
];

const AI_TEAM_NAMES = [
  ["Vellora", "United"],   ["Stonebridge", "Athletic"],
  ["Crimson", "Rovers"],   ["Northgate", "City"],
  ["Pellham", "Wanderers"],["Solace", "Town"],
  ["Mariner's Cove", "FC"],["Ashford", "Rangers"],
  ["Blackmoor", "Knights"],["Silverdale", "Eagles"],
  ["Goldport", "Lions"],   ["Frostholm", "Wolves"],
];

// ─── Deterministic hash for seeding ──────────────────────────────────────────

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function attr(base: number, variance: number, rng: () => number): number {
  return Math.max(30, Math.min(99, base + Math.floor(rng() * variance * 2) - variance));
}

function computeStarRating(attrs: number[]): number {
  const avg = attrs.reduce((a, b) => a + b, 0) / attrs.length;
  if (avg >= 85) return 5;
  if (avg >= 75) return 4;
  if (avg >= 65) return 3;
  if (avg >= 52) return 2;
  return 1;
}

function computeMarketValue(star: number, topAttr: number): number {
  const base = [50000, 150000, 400000, 1000000, 3000000];
  return Math.round(base[star - 1] * (0.8 + topAttr / 100));
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeneratedPlayer {
  name: string;
  position: "GK" | "DF" | "MF" | "FW";
  age: number;
  nationality: string;
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  stamina: number;
  starRating: number;
  marketValue: number;
  avatarSvg: string;
  fitness: number;
  morale: number;
  isInUserSquad: boolean;
}

export interface GeneratedTeam {
  name: string;
  jerseyColor: string;
  logoSvg: string;
  overallAtk: number;
  overallMid: number;
  overallDef: number;
  players: GeneratedPlayer[];
}

// ─── Generate a user's team (from wallet address as seed) ─────────────────────

export function generateUserTeam(walletAddress: string): GeneratedTeam {
  const seed = hashStr(walletAddress);
  const rng = mulberry32(seed);

  // Derive team name from wallet
  const prefix = PREFIXES[Math.floor(rng() * PREFIXES.length)];
  const suffix = SUFFIXES[Math.floor(rng() * SUFFIXES.length)];
  const name = `${prefix}clad ${suffix}`; // e.g. "Ironclad FC"

  const jerseyColor = JERSEY_COLORS[Math.floor(rng() * JERSEY_COLORS.length)];
  const logoSvg = generateClubLogo({ name, primaryColor: jerseyColor });

  return generateTeamPlayers({ name, jerseyColor, logoSvg, isUser: true, rng, quality: 50 });
}

// ─── Generate an AI team (from league seed + index) ───────────────────────────

export function generateAITeam(leagueSeed: string, index: number): GeneratedTeam {
  const seed = hashStr(`${leagueSeed}-ai-${index}`);
  const rng = mulberry32(seed);

  const [prefix, suffix] = AI_TEAM_NAMES[index % AI_TEAM_NAMES.length];
  const name = `${prefix} ${suffix}`;
  const jerseyColor = JERSEY_COLORS[(index + 3) % JERSEY_COLORS.length];
  const logoSvg = generateClubLogo({ name, primaryColor: jerseyColor });

  // AI teams have varied quality for interesting table standings
  const quality = 40 + Math.floor(rng() * 30);

  return generateTeamPlayers({ name, jerseyColor, logoSvg, isUser: false, rng, quality });
}

// ─── Core player generation ───────────────────────────────────────────────────

const SQUAD: Array<{ position: "GK" | "DF" | "MF" | "FW"; count: number }> = [
  { position: "GK", count: 2 },
  { position: "DF", count: 6 },
  { position: "MF", count: 6 },
  { position: "FW", count: 4 },
];

function generateTeamPlayers(opts: {
  name: string;
  jerseyColor: string;
  logoSvg: string;
  isUser: boolean;
  rng: () => number;
  quality: number;
}): GeneratedTeam {
  const { name, jerseyColor, logoSvg, isUser, rng, quality } = opts;
  const usedNames = new Set<string>();
  const players: GeneratedPlayer[] = [];

  for (const { position, count } of SQUAD) {
    for (let j = 0; j < count; j++) {
      // Generate unique name
      let playerName: string;
      let tries = 0;
      do {
        const f = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
        const l = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
        playerName = `${f} ${l}`;
        tries++;
        if (tries > 50) { playerName += ` ${tries}`; break; }
      } while (usedNames.has(playerName));
      usedNames.add(playerName);

      const nationality = NATIONALITIES[Math.floor(rng() * NATIONALITIES.length)];
      const age = 18 + Math.floor(rng() * 18);
      const v = 12;

      let base = { pace: 0, shooting: 0, passing: 0, defending: 0, stamina: 0 };
      switch (position) {
        case "GK":
          base = { pace: attr(quality - 10, v, rng), shooting: attr(20, 5, rng), passing: attr(quality - 5, v, rng), defending: attr(quality + 15, v, rng), stamina: attr(quality, v, rng) };
          break;
        case "DF":
          base = { pace: attr(quality, v, rng), shooting: attr(30, 8, rng), passing: attr(quality, v, rng), defending: attr(quality + 12, v, rng), stamina: attr(quality + 5, v, rng) };
          break;
        case "MF":
          base = { pace: attr(quality, v, rng), shooting: attr(quality, v, rng), passing: attr(quality + 12, v, rng), defending: attr(quality, v, rng), stamina: attr(quality + 10, v, rng) };
          break;
        case "FW":
          base = { pace: attr(quality + 12, v, rng), shooting: attr(quality + 12, v, rng), passing: attr(quality, v, rng), defending: attr(25, 8, rng), stamina: attr(quality, v, rng) };
          break;
      }

      const allAttrs = Object.values(base);
      const starRating = computeStarRating(allAttrs);
      const marketValue = computeMarketValue(starRating, Math.max(...allAttrs));
      const avatarSvg = generatePlayerAvatar({ name: playerName, position, jerseyColor, starRating });

      players.push({
        name: playerName,
        position,
        age,
        nationality,
        ...base,
        starRating,
        marketValue,
        avatarSvg,
        fitness: 90 + Math.floor(rng() * 10),
        morale: 60 + Math.floor(rng() * 30),
        isInUserSquad: isUser,
      });
    }
  }

  // Compute aggregate ratings
  const avgOf = (pos: string, key: keyof GeneratedPlayer) => {
    const pool = players.filter((p) => p.position === pos);
    return Math.round(pool.reduce((s, p) => s + (p[key] as number), 0) / pool.length);
  };

  return {
    name,
    jerseyColor,
    logoSvg,
    overallAtk: Math.round((avgOf("FW", "shooting") + avgOf("MF", "passing")) / 2),
    overallMid: Math.round((avgOf("MF", "passing") + avgOf("MF", "stamina")) / 2),
    overallDef: Math.round((avgOf("DF", "defending") + avgOf("GK", "defending")) / 2),
    players,
  };
}
