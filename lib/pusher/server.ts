import Pusher from "pusher";

/**
 * Pusher server client for triggering events from API routes.
 *
 * Required env vars:
 *   PUSHER_APP_ID
 *   PUSHER_KEY        (same as NEXT_PUBLIC_PUSHER_KEY)
 *   PUSHER_SECRET
 *   PUSHER_CLUSTER
 */
export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID ?? "",
  key: process.env.PUSHER_KEY ?? "",
  secret: process.env.PUSHER_SECRET ?? "",
  cluster: process.env.PUSHER_CLUSTER ?? "ap1",
  useTLS: true,
});

/** Channel naming conventions */
export const CHANNELS = {
  friendly: (code: string) => `friendly-${code}`,
  lobby: (code: string) => `presence-lobby-${code}`,
  spectator: (code: string) => `spectator-${code}`,
};

/** Event names */
export const EVENTS = {
  // Lobby events
  GUEST_JOINED: "guest-joined",
  HOST_READY: "host-ready",
  GUEST_READY: "guest-ready",
  MATCH_START: "match-start",
  LOBBY_EXPIRED: "lobby-expired",
  LOBBY_CANCELLED: "lobby-cancelled",

  // Match events (streamed one by one)
  MATCH_EVENT: "match-event",
  MATCH_SCORE: "match-score",
  MATCH_END: "match-end",
} as const;
