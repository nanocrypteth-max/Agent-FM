import seedrandom from "./seedrandom";
import type {
  MatchSimInput,
  MatchSimResult,
  MatchEvent,
  EventType,
  Position2D,
  Mentality,
  MatchPlayer,
} from "./types";

const HOME_GOAL: Position2D = { x: 0, y: 50 };
const AWAY_GOAL: Position2D = { x: 100, y: 50 };

const MENTALITY_MOD: Record<Mentality, { atk: number; def: number }> = {
  DEFENSIVE: { atk: 0.85, def: 1.15 },
  BALANCED: { atk: 1.0, def: 1.0 },
  ATTACKING: { atk: 1.15, def: 0.85 },
};

export function simulateMatch(input: MatchSimInput, seed: string): MatchSimResult {
  const rng = seedrandom(seed);
  const events: MatchEvent[] = [];
  let homeScore = 0;
  let awayScore = 0;

  const homeMod = MENTALITY_MOD[input.homeTactics.mentality];
  const awayMod = MENTALITY_MOD[input.awayTactics.mentality];

  const homeAtk = input.homeTeam.overallAtk * homeMod.atk;
  const homeDef = input.homeTeam.overallDef * homeMod.def;
  const awayAtk = input.awayTeam.overallAtk * awayMod.atk;
  const awayDef = input.awayTeam.overallDef * awayMod.def;

  // Pre-validate: each side needs exactly 1 GK in startingXI, or engine throws clearly
  assertHasGK(input.homeTeam, input.homeTactics.startingXI, "home");
  assertHasGK(input.awayTeam, input.awayTactics.startingXI, "away");

  events.push(makeEvent(0, 0, "KICK_OFF", "HOME", null, { x: 50, y: 50 }));

  for (let minute = 1; minute <= 90; minute++) {
    if (minute === 45) {
      events.push(makeEvent(45, 0, "HALF_TIME", "HOME", null, { x: 50, y: 50 }));
    }

    const homeChanceProb = clampProb(0.15 + (homeAtk - awayDef) / 400);
    const awayChanceProb = clampProb(0.12 + (awayAtk - homeDef) / 400);

    if (rng() < homeChanceProb) {
      const goal = processChance(rng, input, "HOME", events, minute, homeAtk, awayDef, "AWAY_GOAL");
      if (goal) homeScore++;
    }

    if (rng() < awayChanceProb) {
      const goal = processChance(rng, input, "AWAY", events, minute, awayAtk, homeDef, "HOME_GOAL");
      if (goal) awayScore++;
    }

    if (rng() < 0.03) {
      generateFoulEvent(rng, input, events, minute);
    }
  }

  events.push(makeEvent(90, 0, "FULL_TIME", "HOME", null, { x: 50, y: 50 }));

  return { homeScore, awayScore, events };
}

function processChance(
  rng: () => number,
  input: MatchSimInput,
  team: "HOME" | "AWAY",
  events: MatchEvent[],
  minute: number,
  atkStrength: number,
  defStrength: number,
  targetGoal: "HOME_GOAL" | "AWAY_GOAL"
): boolean {
  const teamData = team === "HOME" ? input.homeTeam : input.awayTeam;
  const tactics = team === "HOME" ? input.homeTactics : input.awayTactics;

  const shooter = pickPlayerByPosition(teamData.players, tactics.startingXI, ["FW", "MF"], rng);

  const shotPos = randomAttackingPosition(team, rng);
  events.push(makeEvent(minute, secOffset(rng), "SHOT", team, shooter.id, shotPos));

  const goalProb = clampProb(
    0.10 + (shooter.shooting - 50) / 300 + (atkStrength - defStrength) / 500
  );

  if (rng() < goalProb) {
    const goalPos = targetGoal === "HOME_GOAL" ? HOME_GOAL : AWAY_GOAL;
    events.push(makeEvent(minute, secOffset(rng), "GOAL", team, shooter.id, goalPos, {
      outcome: "ON_TARGET",
    }));
    return true;
  } else {
    const outcome = rng() < 0.5 ? "SAVE" : "OFF_TARGET";
    if (outcome === "SAVE") {
      const defendingTeam = team === "HOME" ? input.awayTeam : input.homeTeam;
      const defendingTactics = team === "HOME" ? input.awayTactics : input.homeTactics;
      const gk = findGK(defendingTeam, defendingTactics);
      const goalPos = targetGoal === "HOME_GOAL" ? HOME_GOAL : AWAY_GOAL;
      events.push(
        makeEvent(minute, secOffset(rng), "SAVE", team === "HOME" ? "AWAY" : "HOME", gk.id, goalPos)
      );
    }
    return false;
  }
}

function generateFoulEvent(rng: () => number, input: MatchSimInput, events: MatchEvent[], minute: number) {
  const team: "HOME" | "AWAY" = rng() < 0.5 ? "HOME" : "AWAY";
  const teamData = team === "HOME" ? input.homeTeam : input.awayTeam;
  const tactics = team === "HOME" ? input.homeTactics : input.awayTactics;
  const player = pickPlayerByPosition(teamData.players, tactics.startingXI, ["DF", "MF"], rng);
  const pos = { x: rng() * 100, y: rng() * 100 };

  events.push(makeEvent(minute, secOffset(rng), "FOUL", team, player.id, pos));

  if (rng() < 0.08) {
    events.push(makeEvent(minute, secOffset(rng), "YELLOW_CARD", team, player.id, pos));
  }
}

// --- Helpers ---

function makeEvent(
  minute: number,
  second: number,
  type: EventType,
  team: "HOME" | "AWAY",
  playerId: string | null,
  position: Position2D,
  meta?: MatchEvent["meta"]
): MatchEvent {
  return { minute, second, type, team, playerId, position, meta };
}

function clampProb(p: number): number {
  return Math.max(0, Math.min(1, p));
}

function secOffset(rng: () => number): number {
  return Math.floor(rng() * 60);
}

function pickPlayerByPosition(
  players: MatchPlayer[],
  startingXI: string[],
  preferredPositions: string[],
  rng: () => number
): MatchPlayer {
  const startingSet = new Set(startingXI);
  const eligible = players.filter((p) => startingSet.has(p.id) && preferredPositions.includes(p.position));
  const pool = eligible.length > 0 ? eligible : players.filter((p) => startingSet.has(p.id));

  if (pool.length === 0) {
    throw new Error("No eligible players found in startingXI for chance generation");
  }

  return pool[Math.floor(rng() * pool.length)];
}

function findGK(team: { players: MatchPlayer[] }, tactics: { startingXI: string[] }): MatchPlayer {
  const gk = team.players.find((p) => p.position === "GK" && tactics.startingXI.includes(p.id));
  if (!gk) throw new Error("No GK found in startingXI — this should have been caught by assertHasGK");
  return gk;
}

function assertHasGK(team: { players: MatchPlayer[]; id: string }, startingXI: string[], label: string) {
  const gkCount = team.players.filter((p) => p.position === "GK" && startingXI.includes(p.id)).length;
  if (gkCount !== 1) {
    throw new Error(
      `Invalid tactics for ${label} team (${team.id}): expected exactly 1 GK in startingXI, found ${gkCount}`
    );
  }
}

function randomAttackingPosition(team: "HOME" | "AWAY", rng: () => number): Position2D {
  const baseX = team === "HOME" ? 80 + rng() * 15 : 5 + rng() * 15;
  return { x: baseX, y: 30 + rng() * 40 };
}
