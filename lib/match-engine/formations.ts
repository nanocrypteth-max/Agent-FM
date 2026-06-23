import type { Formation, Position2D } from "./types";

// Each slot has: position on pitch + role label shown to user
export interface FormationSlot extends Position2D {
  label: string; // e.g. "GK", "LB", "CDM", "SS"
  posGroup: "GK" | "DF" | "MF" | "FW";
}

/**
 * Full formation definitions with per-slot role labels.
 * Coordinate space: x=0 (own goal) → x=100 (opponent goal), y=0 (top) → y=100 (bottom).
 * HOME side: GK near x=6, attacking right.
 */
const FORMATION_DEFS: Record<string, FormationSlot[]> = {
  "4-4-2": [
    { x: 6, y: 50, label: "GK", posGroup: "GK" },
    { x: 18, y: 18, label: "LB", posGroup: "DF" },
    { x: 18, y: 38, label: "CB", posGroup: "DF" },
    { x: 18, y: 62, label: "CB", posGroup: "DF" },
    { x: 18, y: 82, label: "RB", posGroup: "DF" },
    { x: 38, y: 20, label: "LM", posGroup: "MF" },
    { x: 38, y: 42, label: "CM", posGroup: "MF" },
    { x: 38, y: 58, label: "CM", posGroup: "MF" },
    { x: 38, y: 80, label: "RM", posGroup: "MF" },
    { x: 58, y: 38, label: "ST", posGroup: "FW" },
    { x: 58, y: 62, label: "ST", posGroup: "FW" },
  ],
  "4-3-3": [
    { x: 6, y: 50, label: "GK", posGroup: "GK" },
    { x: 18, y: 18, label: "LB", posGroup: "DF" },
    { x: 18, y: 38, label: "CB", posGroup: "DF" },
    { x: 18, y: 62, label: "CB", posGroup: "DF" },
    { x: 18, y: 82, label: "RB", posGroup: "DF" },
    { x: 38, y: 30, label: "CM", posGroup: "MF" },
    { x: 38, y: 50, label: "CM", posGroup: "MF" },
    { x: 38, y: 70, label: "CM", posGroup: "MF" },
    { x: 58, y: 22, label: "LW", posGroup: "FW" },
    { x: 56, y: 50, label: "ST", posGroup: "FW" },
    { x: 58, y: 78, label: "RW", posGroup: "FW" },
  ],
  "4-2-3-1": [
    { x: 6, y: 50, label: "GK", posGroup: "GK" },
    { x: 18, y: 18, label: "LB", posGroup: "DF" },
    { x: 18, y: 38, label: "CB", posGroup: "DF" },
    { x: 18, y: 62, label: "CB", posGroup: "DF" },
    { x: 18, y: 82, label: "RB", posGroup: "DF" },
    { x: 34, y: 38, label: "CDM", posGroup: "MF" },
    { x: 34, y: 62, label: "CDM", posGroup: "MF" },
    { x: 50, y: 22, label: "LAM", posGroup: "MF" },
    { x: 50, y: 50, label: "CAM", posGroup: "MF" },
    { x: 50, y: 78, label: "RAM", posGroup: "MF" },
    { x: 64, y: 50, label: "ST", posGroup: "FW" },
  ],
  "3-5-2": [
    { x: 6, y: 50, label: "GK", posGroup: "GK" },
    { x: 18, y: 28, label: "CB", posGroup: "DF" },
    { x: 18, y: 50, label: "CB", posGroup: "DF" },
    { x: 18, y: 72, label: "CB", posGroup: "DF" },
    { x: 38, y: 14, label: "LWB", posGroup: "MF" },
    { x: 36, y: 36, label: "CM", posGroup: "MF" },
    { x: 36, y: 64, label: "CM", posGroup: "MF" },
    { x: 38, y: 86, label: "RWB", posGroup: "MF" },
    { x: 40, y: 50, label: "CAM", posGroup: "MF" },
    { x: 58, y: 40, label: "ST", posGroup: "FW" },
    { x: 58, y: 60, label: "ST", posGroup: "FW" },
  ],
  "5-3-2": [
    { x: 6, y: 50, label: "GK", posGroup: "GK" },
    { x: 16, y: 12, label: "LWB", posGroup: "DF" },
    { x: 18, y: 32, label: "CB", posGroup: "DF" },
    { x: 18, y: 50, label: "CB", posGroup: "DF" },
    { x: 18, y: 68, label: "CB", posGroup: "DF" },
    { x: 16, y: 88, label: "RWB", posGroup: "DF" },
    { x: 38, y: 32, label: "CM", posGroup: "MF" },
    { x: 38, y: 50, label: "CM", posGroup: "MF" },
    { x: 38, y: 68, label: "CM", posGroup: "MF" },
    { x: 58, y: 40, label: "ST", posGroup: "FW" },
    { x: 58, y: 60, label: "ST", posGroup: "FW" },
  ],
  "4-5-1": [
    { x: 6, y: 50, label: "GK", posGroup: "GK" },
    { x: 18, y: 18, label: "LB", posGroup: "DF" },
    { x: 18, y: 38, label: "CB", posGroup: "DF" },
    { x: 18, y: 62, label: "CB", posGroup: "DF" },
    { x: 18, y: 82, label: "RB", posGroup: "DF" },
    { x: 38, y: 14, label: "LM", posGroup: "MF" },
    { x: 38, y: 34, label: "CM", posGroup: "MF" },
    { x: 38, y: 50, label: "CM", posGroup: "MF" },
    { x: 38, y: 66, label: "CM", posGroup: "MF" },
    { x: 38, y: 86, label: "RM", posGroup: "MF" },
    { x: 58, y: 50, label: "ST", posGroup: "FW" },
  ],
  // New formations with SS slot
  "4-4-1-1": [
    { x: 6, y: 50, label: "GK", posGroup: "GK" },
    { x: 18, y: 18, label: "LB", posGroup: "DF" },
    { x: 18, y: 38, label: "CB", posGroup: "DF" },
    { x: 18, y: 62, label: "CB", posGroup: "DF" },
    { x: 18, y: 82, label: "RB", posGroup: "DF" },
    { x: 38, y: 20, label: "LM", posGroup: "MF" },
    { x: 38, y: 42, label: "CM", posGroup: "MF" },
    { x: 38, y: 58, label: "CM", posGroup: "MF" },
    { x: 38, y: 80, label: "RM", posGroup: "MF" },
    { x: 52, y: 50, label: "SS", posGroup: "FW" }, // second striker behind ST
    { x: 64, y: 50, label: "ST", posGroup: "FW" },
  ],
  "4-3-1-2": [
    { x: 6, y: 50, label: "GK", posGroup: "GK" },
    { x: 18, y: 18, label: "LB", posGroup: "DF" },
    { x: 18, y: 38, label: "CB", posGroup: "DF" },
    { x: 18, y: 62, label: "CB", posGroup: "DF" },
    { x: 18, y: 82, label: "RB", posGroup: "DF" },
    { x: 36, y: 28, label: "CM", posGroup: "MF" },
    { x: 36, y: 50, label: "CDM", posGroup: "MF" },
    { x: 36, y: 72, label: "CM", posGroup: "MF" },
    { x: 52, y: 50, label: "SS", posGroup: "FW" }, // attacking mid / second striker
    { x: 64, y: 36, label: "ST", posGroup: "FW" },
    { x: 64, y: 64, label: "ST", posGroup: "FW" },
  ],
};

export const FORMATIONS = Object.keys(FORMATION_DEFS) as Formation[];

/**
 * Returns full slot definitions (position + label) for HOME side.
 * AWAY mirrors x-axis so GK is near x=94.
 */
export function formationToSlots(
  formation: Formation,
  side: "HOME" | "AWAY",
): FormationSlot[] {
  const slots = FORMATION_DEFS[formation] ?? FORMATION_DEFS["4-4-2"];
  if (side === "HOME") return slots;
  return slots.map((s) => ({ ...s, x: 100 - s.x }));
}

// Legacy compat: returns just Position2D array (used by match engine internally)
export function formationToPositions(
  formation: Formation,
  side: "HOME" | "AWAY",
): Position2D[] {
  return formationToSlots(formation, side).map(({ x, y }) => ({ x, y }));
}
