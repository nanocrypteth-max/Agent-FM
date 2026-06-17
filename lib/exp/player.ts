import type { MatchEvent } from "@/lib/match-engine/types";

/**
 * Determine MVP of a match from event log.
 * Scoring: GOAL = 3pts, SHOT = 1pt, SAVE = 2pts, ASSIST (via meta) = 2pts
 * Returns playerId of MVP, or null if no player events.
 */
export function computeMVP(events: MatchEvent[]): string | null {
  const scores: Record<string, number> = {};

  for (const ev of events) {
    if (!ev.playerId) continue;
    scores[ev.playerId] = scores[ev.playerId] ?? 0;

    if (ev.type === "GOAL") scores[ev.playerId] += 3;
    else if (ev.type === "SHOT") scores[ev.playerId] += 1;
    else if (ev.type === "SAVE") scores[ev.playerId] += 2;

    // Assist via meta.relatedPlayerId
    if (ev.meta?.relatedPlayerId && ev.type === "GOAL") {
      scores[ev.meta.relatedPlayerId] = (scores[ev.meta.relatedPlayerId] ?? 0) + 2;
    }
  }

  if (Object.keys(scores).length === 0) return null;
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

/** EXP gained by MVP player */
export const MVP_EXP_GAIN = 50;

/** EXP gained by regular starting XI players */
export const STARTER_EXP_GAIN = 15;

/** Player level thresholds (same curve as manager but slower) */
export function playerLevelFromExp(exp: number): number {
  const thresholds = [0, 50, 150, 300, 500, 750, 1100, 1500, 2000, 2600];
  let level = 1;
  for (let i = 1; i < thresholds.length; i++) {
    if (exp >= thresholds[i]) level = i + 1;
    else break;
  }
  return Math.min(level, 10);
}
