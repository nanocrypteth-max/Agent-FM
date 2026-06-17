/**
 * Manager EXP & Level system.
 * RPG-style: each level requires more EXP than the last.
 */

// EXP required to reach each level (index = level - 1)
const EXP_TABLE: number[] = [
  0,     // level 1 (starting)
  100,   // level 2
  250,   // level 3
  400,   // level 4
  600,   // level 5
  750,   // level 6
  900,   // level 7
  1200,  // level 8
  1600,  // level 9
  2000,  // level 10
];

/** EXP needed to reach a given level from level 1 */
export function expForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level <= EXP_TABLE.length) return EXP_TABLE[level - 1];
  // Level 11+: +500 per level beyond 10
  return EXP_TABLE[EXP_TABLE.length - 1] + (level - EXP_TABLE.length) * 500;
}

/** Calculate level from total EXP */
export function levelFromExp(totalExp: number): number {
  let level = 1;
  while (totalExp >= expForLevel(level + 1)) {
    level++;
    if (level >= 100) break; // hard cap
  }
  return level;
}

/** EXP gained from a match result */
export function matchExpGain(
  result: "WIN" | "DRAW" | "LOSS",
  managerLevel: number
): number {
  const base = result === "WIN" ? 50 : result === "DRAW" ? 20 : 10;
  const levelBonus = result === "WIN" ? managerLevel * 10 : 0;
  return base + levelBonus;
}

/** Training stat gain range based on manager level */
export function trainingGainRange(managerLevel: number): { min: number; max: number } {
  if (managerLevel <= 3) return { min: 1, max: 2 };
  if (managerLevel <= 6) return { min: 1, max: 3 };
  if (managerLevel <= 9) return { min: 2, max: 4 };
  return { min: 2, max: 5 };
}

export const TRAINING_STATS = ["pace", "shooting", "passing", "defending", "stamina"] as const;
export type TrainingStat = typeof TRAINING_STATS[number];

/** EXP needed for next level, and progress percentage */
export function levelProgress(currentExp: number, currentLevel: number): {
  currentLevelExp: number;
  nextLevelExp: number;
  progressPercent: number;
  expToNext: number;
} {
  const currentLevelExp = expForLevel(currentLevel);
  const nextLevelExp = expForLevel(currentLevel + 1);
  const inLevel = currentExp - currentLevelExp;
  const needed = nextLevelExp - currentLevelExp;
  return {
    currentLevelExp,
    nextLevelExp,
    progressPercent: Math.min(100, Math.round((inLevel / needed) * 100)),
    expToNext: Math.max(0, nextLevelExp - currentExp),
  };
}
