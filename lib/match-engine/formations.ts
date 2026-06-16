import type { Formation, Position2D } from "./types";

/**
 * Maps a formation string to 11 base positions on a 0-100 normalized pitch,
 * for the HOME side (attacking left-to-right, GK near x=6).
 * Position order matches conventional formation notation:
 * [GK, defenders..., midfielders..., forwards...]
 */
const HOME_FORMATION_SLOTS: Record<Formation, Position2D[]> = {
  "4-4-2": [
    { x: 6, y: 50 }, // GK
    { x: 18, y: 18 }, { x: 18, y: 38 }, { x: 18, y: 62 }, { x: 18, y: 82 }, // DF x4
    { x: 38, y: 20 }, { x: 38, y: 42 }, { x: 38, y: 58 }, { x: 38, y: 80 }, // MF x4
    { x: 58, y: 38 }, { x: 58, y: 62 }, // FW x2
  ],
  "4-3-3": [
    { x: 6, y: 50 },
    { x: 18, y: 18 }, { x: 18, y: 38 }, { x: 18, y: 62 }, { x: 18, y: 82 },
    { x: 38, y: 30 }, { x: 38, y: 50 }, { x: 38, y: 70 },
    { x: 58, y: 22 }, { x: 56, y: 50 }, { x: 58, y: 78 },
  ],
  "4-2-3-1": [
    { x: 6, y: 50 },
    { x: 18, y: 18 }, { x: 18, y: 38 }, { x: 18, y: 62 }, { x: 18, y: 82 },
    { x: 34, y: 38 }, { x: 34, y: 62 }, // double pivot
    { x: 50, y: 22 }, { x: 50, y: 50 }, { x: 50, y: 78 }, // AM line
    { x: 64, y: 50 }, // ST
  ],
  "3-5-2": [
    { x: 6, y: 50 },
    { x: 18, y: 28 }, { x: 18, y: 50 }, { x: 18, y: 72 },
    { x: 38, y: 14 }, { x: 36, y: 36 }, { x: 36, y: 64 }, { x: 38, y: 86 }, { x: 40, y: 50 },
    { x: 58, y: 40 }, { x: 58, y: 60 },
  ],
  "5-3-2": [
    { x: 6, y: 50 },
    { x: 16, y: 12 }, { x: 18, y: 32 }, { x: 18, y: 50 }, { x: 18, y: 68 }, { x: 16, y: 88 },
    { x: 38, y: 32 }, { x: 38, y: 50 }, { x: 38, y: 68 },
    { x: 58, y: 40 }, { x: 58, y: 60 },
  ],
  "4-5-1": [
    { x: 6, y: 50 },
    { x: 18, y: 18 }, { x: 18, y: 38 }, { x: 18, y: 62 }, { x: 18, y: 82 },
    { x: 38, y: 14 }, { x: 38, y: 34 }, { x: 38, y: 50 }, { x: 38, y: 66 }, { x: 38, y: 86 },
    { x: 58, y: 50 },
  ],
};

/**
 * Returns 11 base positions for the given formation, mirrored for AWAY side
 * (x flipped so AWAY attacks right-to-left, GK near x=94).
 */
export function formationToSlots(formation: Formation, side: "HOME" | "AWAY"): Position2D[] {
  const slots = HOME_FORMATION_SLOTS[formation] ?? HOME_FORMATION_SLOTS["4-4-2"];

  if (side === "HOME") return slots;

  return slots.map((p) => ({ x: 100 - p.x, y: p.y }));
}
