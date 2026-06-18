import { redis, KEYS, utcDateString } from "./client";

/**
 * Check if a club has used their daily training session.
 * 1 training per day per club — manager chooses which player.
 */
export async function canTrainToday(teamId: string): Promise<boolean> {
  const key = KEYS.training(teamId, utcDateString());
  const exists = await redis.exists(key);
  return exists === 0;
}

/**
 * Mark the club as having trained today.
 * TTL: seconds until next midnight UTC.
 */
export async function markTrained(teamId: string): Promise<void> {
  const key = KEYS.training(teamId, utcDateString());
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  const ttlSeconds = Math.ceil((midnight.getTime() - now.getTime()) / 1000);
  await redis.set(key, "1", { ex: ttlSeconds });
}

/**
 * Get training status for multiple teams.
 * Returns map of teamId → canTrain boolean.
 */
export async function getTrainingStatus(
  teamIds: string[],
): Promise<Record<string, boolean>> {
  if (teamIds.length === 0) return {};
  const date = utcDateString();
  const keys = teamIds.map((id) => KEYS.training(id, date));

  const pipeline = redis.pipeline();
  keys.forEach((k) => pipeline.exists(k));
  const results = await pipeline.exec<number[]>();

  return Object.fromEntries(teamIds.map((id, i) => [id, results[i] === 0]));
}
