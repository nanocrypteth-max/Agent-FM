/**
 * App-wide configuration.
 * Change APP_NAME here (or via NEXT_PUBLIC_APP_NAME env var) to rebrand
 * the entire application without touching any other file.
 *
 * To override via environment variable:
 *   NEXT_PUBLIC_APP_NAME="Your New Name"
 * Add it to .env or Vercel Dashboard → Environment Variables.
 */

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Agent FM";

export const APP_TAGLINE = "World Stage 2026";

export const APP_DESCRIPTION = `${APP_NAME} — Football management game with AI managers, Gacha, and real transfer market.`;
