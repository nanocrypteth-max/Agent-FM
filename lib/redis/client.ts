import { Redis } from "@upstash/redis";

/**
 * Upstash Redis client — HTTP-based, serverless-compatible.
 * Works on Vercel Edge and Node.js runtimes without persistent connections.
 * 
 * Required env vars:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL ?? "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
});

// Key helpers — centralized to avoid typos
export const KEYS = {
  /** Training cooldown per player per day: "training:{playerId}:{YYYY-MM-DD}" */
  training: (playerId: string, date: string) => `training:${playerId}:${date}`,

  /** Lobby state in Redis (faster than DB for presence): "lobby:{code}" */
  lobby: (code: string) => `lobby:${code}`,

  /** Online presence for a user: "presence:{wallet}" */
  presence: (wallet: string) => `presence:${wallet}`,

  /** Match broadcast lock (prevent double-simulate): "match-lock:{matchId}" */
  matchLock: (matchId: string) => `match-lock:${matchId}`,
};

/** UTC date string YYYY-MM-DD */
export function utcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
