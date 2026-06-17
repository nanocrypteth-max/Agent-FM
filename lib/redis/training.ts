import { redis, KEYS, utcDateString } from "./client";

/**
 * Check if a player has been trained today.
 * Returns true if training is available, false if cooldown active.
 */
export async function canTrainToday(playerId: string): Promise<boolean> {
  const key = KEYS.training(playerId, utcDateString());
  const exists = await redis.exists(key);
  return exists === 0;
}

/**
 * Mark a player as trained today.
 * TTL: seconds until next midnight UTC.
 */
export async function markTrained(playerId: string): Promise<void> {
  const key = KEYS.training(playerId, utcDateString());
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  const ttlSeconds = Math.ceil((midnight.getTime() - now.getTime()) / 1000);
  await redis.set(key, "1", { ex: ttlSeconds });
}

/**
 * Get training status for multiple players at once.
 * Returns a map of playerId → canTrain boolean.
 */
export async function getTrainingStatus(
  playerIds: string[]
): Promise<Record<string, boolean>> {
  if (playerIds.length === 0) return {};
  const date = utcDateString();
  const keys = playerIds.map((id) => KEYS.training(id, date));

  // Upstash supports pipeline for batch ops
  const pipeline = redis.pipeline();
  keys.forEach((k) => pipeline.exists(k));
  const results = await pipeline.exec<number[]>();

  return Object.fromEntries(
    playerIds.map((id, i) => [id, results[i] === 0])
  );
}
